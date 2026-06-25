#!/usr/bin/env python3
"""Regression guard for the export path: upload -> detect -> export.

This is a CI-style check (registered as part of the ``flows`` validation step).
It drives the app's export pipeline over HTTP against the real FastAPI backend,
exercising the non-production test-auth seam (see ``backend/auth.py``):

  1. log in          GET  /api/__test/login?username=...        -> 302, sets the
                     dt_test_user cookie (the harness can't carry a real
                     Replit REPL_AUTH cookie)
  2. upload audio    POST /api/audio/upload (multipart)          -> 200 with an
                     audio_id, using the bundled drumtracker_audio.mp3 fixture
  3. detect hits     POST /api/detection/detect {audio_id}       -> 200 with a
                     detection_id and one or more detected hits
  4. export MIDI     GET  /api/export/midi/{detection_id}        -> 200 with a
                     valid Standard MIDI File (``MThd`` header)
  5. export session  GET  /api/sessions/{detection_id}/export    -> 200 with a
                     valid ZIP archive (``PK`` header)

The export endpoints are what let users get their results out of the app, so a
future change to the MIDI/session export logic can never silently break the
flow: any broken step fails loudly with a non-zero exit code.

The backend boot/HTTP/cookie machinery lives in ``flow_harness`` so a single
combined run (``check_all_flows.py``) can boot the backend once and drive every
flow against it; this script stays independently runnable for debugging.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from flow_harness import (  # noqa: E402
    Checks,
    Conn,
    detect,
    login,
    run_standalone,
    snip,
    upload_fixture,
)

MIDI_MAGIC = b"MThd"
ZIP_MAGIC = b"PK\x03\x04"


def run_flow(conn: Conn) -> Checks:
    chk = Checks()

    cookie_header = login(conn, chk)
    audio_id = upload_fixture(conn, chk, cookie_header)
    if not audio_id:
        # Without an audio_id the rest of the flow cannot proceed.
        return chk

    detection_id = detect(conn, chk, cookie_header, audio_id)
    if not detection_id:
        return chk

    # 4. Export the detection as a Standard MIDI File.
    status, raw, _, _, ctype = conn.request(
        "GET", f"/api/export/midi/{detection_id}", cookie=cookie_header
    )
    chk.expect(
        status == 200,
        "GET /api/export/midi/{id} -> 200",
        f"got {status}: {snip(raw)}",
    )
    chk.expect(
        raw.startswith(MIDI_MAGIC),
        "MIDI export has a valid MThd header",
        f"first bytes={raw[:8]!r}, content-type={ctype!r}",
    )
    chk.expect(
        len(raw) > len(MIDI_MAGIC),
        "MIDI export is non-empty",
        f"len={len(raw)}",
    )

    # 5. Export the full session as a ZIP archive.
    status, raw, _, _, ctype = conn.request(
        "GET", f"/api/sessions/{detection_id}/export", cookie=cookie_header
    )
    chk.expect(
        status == 200,
        "GET /api/sessions/{id}/export -> 200",
        f"got {status}: {snip(raw)}",
    )
    chk.expect(
        raw.startswith(ZIP_MAGIC),
        "session export has a valid ZIP header",
        f"first bytes={raw[:8]!r}, content-type={ctype!r}",
    )
    chk.expect(
        len(raw) > len(ZIP_MAGIC),
        "session export is non-empty",
        f"len={len(raw)}",
    )

    return chk


def main() -> int:
    return run_standalone(
        "Driving upload -> detect -> export flow:", "EXPORT FLOW CHECK", run_flow
    )


if __name__ == "__main__":
    sys.exit(main())
