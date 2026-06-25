#!/usr/bin/env python3
"""Regression guard for the core value path: upload -> detect -> fetch.

This is a CI-style check (registered as part of the ``flows`` validation step).
It drives the app's core pipeline over HTTP against the real FastAPI backend,
exercising the non-production test-auth seam (see ``backend/auth.py``):

  1. log in          GET  /api/__test/login?username=...   -> 302, sets the
                     dt_test_user cookie (the harness can't carry a real
                     Replit REPL_AUTH cookie)
  2. upload audio    POST /api/audio/upload (multipart)     -> 200 with an
                     audio_id, using the bundled drumtracker_audio.mp3 fixture
  3. detect hits     POST /api/detection/detect {audio_id}  -> 200 with a
                     detection_id and one or more detected hits
  4. fetch detection GET  /api/detection/{detection_id}     -> 200 and the
                     persisted result matches (same id, hits present)

Any broken step fails loudly with a non-zero exit code so a future change to
the audio/detection engines or endpoints can never silently break the flow.

The backend boot/HTTP/cookie machinery lives in ``flow_harness`` so a single
combined run (``check_all_flows.py``) can boot the backend once and drive every
flow against it; this script stays independently runnable for debugging.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from flow_harness import (  # noqa: E402
    Checks,
    Conn,
    detect,
    json_field,
    login,
    run_standalone,
    snip,
    upload_fixture,
)


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

    # 4. Fetch the persisted detection back.
    status, raw, _, _, _ = conn.request(
        "GET", f"/api/detection/{detection_id}", cookie=cookie_header
    )
    chk.expect(status == 200, "GET /api/detection/{id} -> 200", f"got {status}: {snip(raw)}")
    chk.expect(
        json_field(raw, "detection_id") == detection_id,
        "fetched detection id matches",
        f"body={snip(raw)}",
    )
    try:
        hits = json.loads(raw.decode("utf-8", "replace")).get("hits") or []
    except Exception:
        hits = []
    chk.expect(len(hits) > 0, "fetched detection contains hits", f"hits={len(hits)}")

    return chk


def main() -> int:
    return run_standalone(
        "Driving upload -> detect -> fetch flow:", "DETECT FLOW CHECK", run_flow
    )


if __name__ == "__main__":
    sys.exit(main())
