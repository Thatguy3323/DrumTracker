#!/usr/bin/env python3
"""Fast unit-level guard for the heavy-flow concurrency throttle.

``check_all_flows.py`` drives every flow concurrently against one backend, but
caps how many *heavy* flows (those that boot torch / open-unmix / essentia for
detection/conversion) run their work at once behind a semaphore, while leaving
the light AUTH flow unthrottled. That guarantee is otherwise only exercised by a
full, multi-second end-to-end run.

This check locks in the guarantee without booting any backend: it wires fake
``run_flow`` callables (no HTTP, no torch) through the real ``_drive_flow`` and
the same semaphore/ThreadPoolExecutor wiring ``main()`` uses, and asserts:

  * at most ``_heavy_concurrency()`` heavy flows are ever inside their work at
    once, and the peak actually reaches that cap (the throttle bites but isn't
    stricter than configured), and
  * the light AUTH flow runs immediately even while every heavy slot is taken
    and held -- i.e. it is never queued behind the gate.

It runs in well under a second and is registered as the ``concurrency`` CI-style
validation step. Independently runnable: ``python scripts/check_concurrency_cap.py``.
"""
from __future__ import annotations

import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from flow_harness import Checks, set_thread_output  # noqa: E402

import check_all_flows  # noqa: E402

# How long a held heavy flow / a blocked assertion may wait before we treat the
# throttle as broken. Generous vs. the real (sub-millisecond) scheduling, tiny
# vs. a human, so a regression fails fast instead of hanging CI.
TIMEOUT_S = 5.0


class _Tracker:
    """Records concurrent entries into the heavy flows' "work" section."""

    def __init__(self, cap: int) -> None:
        self._cap = cap
        self._lock = threading.Lock()
        self.active = 0
        self.peak = 0
        # Set once ``cap`` heavy flows are simultaneously inside their work.
        self.saturated = threading.Event()
        # Heavy flows hold here until the test lets them finish, so the gate
        # stays full while we check that AUTH is not stuck behind it.
        self.release = threading.Event()

    def enter(self) -> None:
        with self._lock:
            self.active += 1
            if self.active > self.peak:
                self.peak = self.active
            if self.active >= self._cap:
                self.saturated.set()

    def leave(self) -> None:
        with self._lock:
            self.active -= 1


def _run(chk: Checks) -> int:
    cap = check_all_flows._heavy_concurrency()

    # More heavy flows than the cap so the gate must actually queue some of
    # them; a single light AUTH flow that must never be throttled.
    heavy_names = [f"HEAVY{i}" for i in range(cap + 2)]
    tracker = _Tracker(cap)
    auth_done = threading.Event()

    def heavy_flow(_conn) -> Checks:
        tracker.enter()
        try:
            # Hold the slot until the test releases us, keeping the gate full.
            tracker.release.wait(TIMEOUT_S)
        finally:
            tracker.leave()
        return Checks()

    def auth_flow(_conn) -> Checks:
        auth_done.set()
        return Checks()

    flows: list[tuple[str, object, bool]] = [("AUTH", auth_flow, False)]
    flows += [(name, heavy_flow, True) for name in heavy_names]

    heavy_gate = threading.Semaphore(cap)
    try:
        with ThreadPoolExecutor(max_workers=len(flows)) as pool:
            futures = [
                pool.submit(
                    check_all_flows._drive_flow,
                    name,
                    run_flow,
                    None,  # fake flows ignore the conn
                    heavy_gate if heavy else None,
                )
                for name, run_flow, heavy in flows
            ]

            # The gate should fill to exactly ``cap`` heavy flows.
            saturated = tracker.saturated.wait(TIMEOUT_S)
            chk.expect(
                saturated,
                f"heavy flows reach the cap of {cap} concurrent",
                f"only {tracker.peak} ran at once within {TIMEOUT_S}s",
            )

            # AUTH must complete even though every heavy slot is taken AND held
            # open. If AUTH were (wrongly) routed through the gate it would
            # deadlock here, since no slot will free until we release below.
            auth_ran = auth_done.wait(TIMEOUT_S)
            chk.expect(
                auth_ran,
                "light AUTH flow runs immediately, never throttled",
                f"AUTH did not finish within {TIMEOUT_S}s while heavy gate full",
            )

            # Let the held heavy flows drain and the rest run through the gate.
            tracker.release.set()
            for f in futures:
                f.result(timeout=TIMEOUT_S)
    finally:
        tracker.release.set()
        set_thread_output(None)

    chk.expect(
        tracker.peak == cap,
        f"peak heavy concurrency equals the cap ({cap})",
        f"peak was {tracker.peak}",
    )
    chk.expect(
        tracker.peak <= cap,
        f"heavy concurrency never exceeds the cap ({cap})",
        f"peak was {tracker.peak}",
    )
    return 0


def main() -> int:
    chk = Checks()
    print("Concurrency-cap check (no backend boot):\n")
    _run(chk)
    print()
    if chk.failures:
        print(
            f"CONCURRENCY CAP CHECK FAILED: {len(chk.failures)} of "
            f"{chk.passed + len(chk.failures)} assertions failed:"
        )
        for f in chk.failures:
            print(f"  - {f}")
        return 1
    print(f"CONCURRENCY CAP CHECK PASSED: all {chk.passed} assertions passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
