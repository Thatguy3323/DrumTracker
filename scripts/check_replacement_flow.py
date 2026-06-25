#!/usr/bin/env python3
"""Regression guard for the drum-replacement export: upload -> detect -> replace.

This is a CI-style check (registered as part of the ``flows`` validation step).
It drives the drum-replacement export over HTTP against the real FastAPI
backend, using the non-production test-auth seam (see ``backend/auth.py``):

  1. log in          GET  /api/__test/login?username=...     -> 302, sets the
                     dt_test_user cookie (the harness can't carry a real
                     Replit REPL_AUTH cookie)
  2. upload audio    POST /api/audio/upload (multipart)       -> 200 with an
                     audio_id, using the bundled drumtracker_audio.mp3 fixture
  3. detect hits     POST /api/detection/detect {audio_id}    -> 200 with a
                     detection_id and one or more detected hits
  4. replace (augment)  POST /api/replacement/process         -> 200 with a
                     valid, non-empty WAV (``RIFF``/``WAVE`` header), keeping the
                     original audio under the synthesized kit
  5. replace (replace)  POST /api/replacement/process         -> 200 with a
                     valid, non-empty WAV when the original is dropped
                     (keep_original=false exercises the other engine branch)

The replacement endpoint is what lets users download their augmented/replaced
audio, so a future change to the replacement engine can never silently break the
flow: any broken step fails loudly with a non-zero exit code.

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
    login,
    run_standalone,
    snip,
    upload_fixture,
)

# A valid WAV is a RIFF container whose form-type (bytes 8-11) is "WAVE".
RIFF_MAGIC = b"RIFF"
WAVE_MAGIC = b"WAVE"


def _check_wav(chk: Checks, label: str, status: int, raw: bytes, ctype: str | None) -> None:
    chk.expect(status == 200, f"{label} -> 200", f"got {status}: {snip(raw)}")
    chk.expect(
        bool(ctype) and ctype.startswith("audio/wav"),
        f"{label} is served as audio/wav",
        f"content-type={ctype!r}",
    )
    valid_wav = raw[:4] == RIFF_MAGIC and raw[8:12] == WAVE_MAGIC
    chk.expect(
        valid_wav,
        f"{label} returns a valid WAV (RIFF/WAVE header)",
        f"first bytes={raw[:12]!r}, content-type={ctype!r}",
    )
    # Header alone is 44 bytes; anything real is much larger than that.
    chk.expect(
        len(raw) > 44,
        f"{label} WAV is non-empty",
        f"len={len(raw)}",
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

    # 4. Replace drums keeping the original audio (augmented mode).
    augment_body = json.dumps(
        {"detection_id": detection_id, "keep_original": True}
    ).encode("utf-8")
    status, raw, _, _, ctype = conn.request(
        "POST",
        "/api/replacement/process",
        cookie=cookie_header,
        body=augment_body,
        content_type="application/json",
    )
    _check_wav(chk, "POST /api/replacement/process (augment)", status, raw, ctype)

    # 5. Replace drums dropping the original audio (replaced mode) — exercises the
    #    other branch of the engine (zeros base track instead of copying input).
    replace_body = json.dumps(
        {"detection_id": detection_id, "keep_original": False}
    ).encode("utf-8")
    status, raw, _, _, ctype = conn.request(
        "POST",
        "/api/replacement/process",
        cookie=cookie_header,
        body=replace_body,
        content_type="application/json",
    )
    _check_wav(chk, "POST /api/replacement/process (replace)", status, raw, ctype)

    return chk


def main() -> int:
    return run_standalone(
        "Driving upload -> detect -> replacement flow:",
        "REPLACEMENT FLOW CHECK",
        run_flow,
    )


if __name__ == "__main__":
    sys.exit(main())
