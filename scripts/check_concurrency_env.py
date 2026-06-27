#!/usr/bin/env python3
"""Fast unit-level guard for _heavy_concurrency() parsing and clamping.

``check_all_flows.py`` derives the heavy-flow concurrency cap from the
``FLOW_CHECK_HEAVY_CONCURRENCY`` environment variable.  The parsing has four
distinct paths that are otherwise only exercised by a full end-to-end run:

  * env var unset   → default (DEFAULT_HEAVY_CONCURRENCY)
  * valid integer   → that integer
  * value < 1      → clamped up to 1 (prevents a zero-cap that lets everything through)
  * non-numeric     → default, with a warning on stdout

This check exercises all four paths without booting any backend.  It runs in
well under a second and is independently runnable:
``python scripts/check_concurrency_env.py``.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from flow_harness import Checks  # noqa: E402

import check_all_flows  # noqa: E402

_ENV = "FLOW_CHECK_HEAVY_CONCURRENCY"
_DEFAULT = check_all_flows.DEFAULT_HEAVY_CONCURRENCY


def _call(value: str | None) -> int:
    """Call _heavy_concurrency() with the env var set to *value* (or unset)."""
    old = os.environ.pop(_ENV, None)
    try:
        if value is not None:
            os.environ[_ENV] = value
        return check_all_flows._heavy_concurrency()
    finally:
        if old is not None:
            os.environ[_ENV] = old
        else:
            os.environ.pop(_ENV, None)


def _run(chk: Checks) -> None:
    # 1. Unset → default
    got = _call(None)
    chk.expect(
        got == _DEFAULT,
        f"unset env var returns default ({_DEFAULT})",
        f"got {got!r}",
    )

    # 2. Valid integer → that integer
    got = _call("5")
    chk.expect(
        got == 5,
        "valid integer '5' parses to 5",
        f"got {got!r}",
    )

    # 3. Value below 1 → clamped to 1
    for raw in ("0", "-1", "-99"):
        got = _call(raw)
        chk.expect(
            got == 1,
            f"value {raw!r} (< 1) is clamped to 1",
            f"got {got!r}",
        )

    # 4. Non-numeric → default (function prints a warning; we just check the return)
    for raw in ("", "abc", "2.5", "two"):
        got = _call(raw)
        chk.expect(
            got == _DEFAULT,
            f"non-numeric {raw!r} falls back to default ({_DEFAULT})",
            f"got {got!r}",
        )


def main() -> int:
    chk = Checks()
    print("Concurrency-env check (no backend boot):\n")
    _run(chk)
    print()
    if chk.failures:
        print(
            f"CONCURRENCY ENV CHECK FAILED: {len(chk.failures)} of "
            f"{chk.passed + len(chk.failures)} assertions failed:"
        )
        for f in chk.failures:
            print(f"  - {f}")
        return 1
    print(f"CONCURRENCY ENV CHECK PASSED: all {chk.passed} assertions passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
