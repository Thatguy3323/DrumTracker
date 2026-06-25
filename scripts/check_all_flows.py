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
import sys
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

# (display name, run_flow callable). These flows are independent and all hit the
# same running backend, so the combined runner drives them concurrently.
FLOWS: list[tuple[str, object]] = [
    ("AUTH", check_auth_flow.run_flow),
    ("DETECT", check_detect_flow.run_flow),
    ("EXPORT", check_export_flow.run_flow),
    ("REPLACEMENT", check_replacement_flow.run_flow),
    ("CONVERT", check_convert_flow.run_flow),
]


def _drive_flow(name: str, run_flow, conn: Conn) -> tuple[str, Checks, str]:
    """Run one flow against the shared backend, capturing its output.

    Each flow's PASS/FAIL lines are written to a per-thread buffer (via the
    harness's thread-local sink) so concurrent flows don't interleave their
    output; the buffered text is returned for the runner to print grouped under
    the flow's header.
    """
    buf = io.StringIO()
    set_thread_output(buf)
    try:
        chk = run_flow(conn)
    finally:
        set_thread_output(None)
    return name, chk, buf.getvalue()


def main() -> int:
    if not FIXTURE.exists():
        print(f"ERROR: audio fixture not found at {FIXTURE}")
        return 2

    results: list[tuple[str, Checks]] = []
    try:
        with running_backend() as conn:  # type: Conn
            print(
                "Backend healthy. Driving all flow checks concurrently against "
                "one backend:\n"
            )
            with ThreadPoolExecutor(max_workers=len(FLOWS)) as pool:
                futures = {
                    name: pool.submit(_drive_flow, name, run_flow, conn)
                    for name, run_flow in FLOWS
                }
                # Print grouped output in the stable FLOWS order so each flow's
                # pass/fail lines are clearly attributed, regardless of the
                # order they finish in.
                for name, _ in FLOWS:
                    flow_name, chk, output = futures[name].result()
                    print(f"== {flow_name} flow ==")
                    sys.stdout.write(output)
                    results.append((flow_name, chk))
                    print()
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
