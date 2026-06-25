#!/usr/bin/env python3
"""Combined regression guard: boot the backend ONCE, drive every flow.

Each ``check_*_flow.py`` script is independently runnable, but each one boots its
own throwaway FastAPI backend — and because the backend imports torch /
open-unmix / essentia at startup, every boot costs several seconds. Running all
of them separately pays that boot cost once per check, which gets slower as more
guards are added.

This runner boots the backend a single time and drives all the flow checks
against it, preserving each flow's exact assertions. A failure in any flow is
reported loudly and the process exits non-zero, exactly like the per-flow
scripts.
"""
from __future__ import annotations

import io
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from flow_harness import (  # noqa: E402
    FIXTURE,
    BackendBootError,
    Checks,
    Conn,
    running_backend,
    set_thread_output,
)

import check_auth_flow  # noqa: E402
import check_convert_flow  # noqa: E402
import check_detect_flow  # noqa: E402
import check_export_flow  # noqa: E402
import check_replacement_flow  # noqa: E402

# (display name, run_flow callable, heavy?). These flows are independent and all
# hit the same running backend, so the combined runner drives them concurrently.
# ``heavy`` flags flows that trigger audio detection/conversion (torch /
# open-unmix / essentia), which dominate peak CPU and memory; those are throttled
# behind a small semaphore so they don't all run at once on a constrained box.
# The light AUTH flow is left unthrottled so it always runs immediately.
FLOWS: list[tuple[str, object, bool]] = [
    ("AUTH", check_auth_flow.run_flow, False),
    ("DETECT", check_detect_flow.run_flow, True),
    ("EXPORT", check_export_flow.run_flow, True),
    ("REPLACEMENT", check_replacement_flow.run_flow, True),
    ("CONVERT", check_convert_flow.run_flow, True),
]

# Max heavy (detection/conversion) flows allowed to run at once. Tune via the
# FLOW_CHECK_HEAVY_CONCURRENCY env var without touching code; defaults to 2 so a
# low-memory container doesn't try to spin up every torch/essentia pipeline
# simultaneously. Values < 1 are clamped to 1.
DEFAULT_HEAVY_CONCURRENCY = 2


def _heavy_concurrency() -> int:
    raw = os.environ.get("FLOW_CHECK_HEAVY_CONCURRENCY")
    if raw is None:
        return DEFAULT_HEAVY_CONCURRENCY
    try:
        return max(1, int(raw))
    except ValueError:
        print(
            f"WARNING: ignoring invalid FLOW_CHECK_HEAVY_CONCURRENCY={raw!r}; "
            f"using default {DEFAULT_HEAVY_CONCURRENCY}"
        )
        return DEFAULT_HEAVY_CONCURRENCY


# Real-time progress notes (heavy-slot waiting/starting) are written straight to
# the real stdout, bypassing the per-flow buffers, so the throttling is visible
# live instead of only in the grouped output printed after a flow finishes. The
# lock keeps these notes — and the grouped per-flow blocks — from interleaving
# across threads.
_print_lock = threading.Lock()


def _emit(msg: str) -> None:
    """Print a real-time progress line to the real stdout, thread-safely."""
    with _print_lock:
        print(msg, flush=True)


def _drive_flow(
    name: str, run_flow, conn: Conn, gate: "threading.Semaphore | None"
) -> tuple[str, Checks, str]:
    """Run one flow against the shared backend, capturing its assertion output.

    Each flow's PASS/FAIL lines are written to a per-thread buffer (via the
    harness's thread-local sink) so concurrent flows don't interleave their
    output; the buffered text is returned for the runner to print grouped under
    the flow's header.

    Heavy flows pass a ``gate`` semaphore and only start their work once a slot
    is free, bounding concurrent torch/essentia pipelines; light flows pass
    ``None`` and run immediately. A queued heavy flow would otherwise sit silent
    (its assertion output is buffered until it finishes), which looks like a hang
    on a slow box — so it emits a real-time "waiting" / "starting" note around
    the gate to make the throttling visible and diagnosable.
    """
    buf = io.StringIO()
    set_thread_output(buf)
    try:
        if gate is None:
            chk = run_flow(conn)
        else:
            # Try to grab a slot without blocking; only announce "waiting" when
            # the flow actually has to queue behind the heavy-concurrency cap.
            if gate.acquire(blocking=False):
                _emit(f"  ->  {name}: starting (heavy slot free)")
            else:
                _emit(f"  ..  {name}: waiting for a free heavy slot ...")
                gate.acquire()
                _emit(f"  ->  {name}: starting (heavy slot freed up)")
            try:
                chk = run_flow(conn)
            finally:
                gate.release()
    finally:
        set_thread_output(None)
    return name, chk, buf.getvalue()


def main() -> int:
    if not FIXTURE.exists():
        print(f"ERROR: audio fixture not found at {FIXTURE}")
        return 2

    results: list[tuple[str, Checks]] = []
    heavy_limit = _heavy_concurrency()
    heavy_gate = threading.Semaphore(heavy_limit)
    try:
        with running_backend() as conn:  # type: Conn
            print(
                "Backend healthy. Driving all flow checks concurrently against "
                f"one backend (heavy flows capped at {heavy_limit} at a time):\n"
            )
            # Every flow still gets its own worker thread, but heavy flows block
            # on ``heavy_gate`` before doing real work, so at most ``heavy_limit``
            # detection/conversion pipelines run at once.
            with ThreadPoolExecutor(max_workers=len(FLOWS)) as pool:
                futures = {
                    name: pool.submit(
                        _drive_flow,
                        name,
                        run_flow,
                        conn,
                        heavy_gate if heavy else None,
                    )
                    for name, run_flow, heavy in FLOWS
                }
                # Print grouped output in the stable FLOWS order so each flow's
                # pass/fail lines are clearly attributed, regardless of the
                # order they finish in.
                for name, _, _ in FLOWS:
                    flow_name, chk, output = futures[name].result()
                    # Print each flow's grouped block atomically so a concurrent
                    # heavy-slot progress note can't land in the middle of it.
                    with _print_lock:
                        sys.stdout.write(f"== {flow_name} flow ==\n{output}\n")
                        sys.stdout.flush()
                    results.append((flow_name, chk))
    except BackendBootError as e:
        print(f"ERROR: {e.message}")
        if e.logs:
            print(e.logs)
        return 2

    total_passed = sum(c.passed for _, c in results)
    failing = [(name, c) for name, c in results if c.failures]

    print("=" * 60)
    if failing:
        total_failed = sum(len(c.failures) for _, c in failing)
        print(
            f"FLOW CHECKS FAILED: {total_failed} assertion(s) failed across "
            f"{len(failing)} flow(s) ({total_passed} passed):"
        )
        for name, c in failing:
            for f in c.failures:
                print(f"  - [{name}] {f}")
        return 1

    print(
        f"ALL FLOW CHECKS PASSED: {total_passed} assertions across "
        f"{len(results)} flows, on a single backend boot."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
