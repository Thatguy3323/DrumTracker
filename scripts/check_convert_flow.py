#!/usr/bin/env python3
"""Regression guard for the format-conversion path: upload -> convert -> download.

This is a CI-style check (registered as part of the ``flows`` validation step).
It drives the app's FFmpeg conversion pipeline over HTTP against the real
FastAPI backend, exercising the non-production test-auth seam (see
``backend/auth.py``):

  1. log in            GET  /api/__test/login?username=...        -> 302, sets the
                       dt_test_user cookie (the harness can't carry a real
                       Replit REPL_AUTH cookie)
  2. upload audio      POST /api/audio/upload (multipart)          -> 200 with an
                       audio_id, using the bundled drumtracker_audio.mp3 fixture
  3. start conversion  POST /api/convert/start {audio_id, format}  -> 200 with a
                       job_id (one job per target format)
  4. poll status       GET  /api/convert/{job_id}/status           -> 200 until the
                       background FFmpeg job reports "done" (or "failed")
  5. download result   GET  /api/convert/{job_id}/download         -> 200 with a
                       valid, non-empty file whose magic bytes match the format

The conversion endpoints are another way users get their results out of the app,
so a future change to the FFmpeg conversion logic can never silently break the
flow: any broken step fails loudly with a non-zero exit code.

The backend boot/HTTP/cookie machinery lives in ``flow_harness`` so a single
combined run (``check_all_flows.py``) can boot the backend once and drive every
flow against it; this script stays independently runnable for debugging.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from flow_harness import (  # noqa: E402
    Checks,
    Conn,
    json_field,
    login,
    run_standalone,
    snip,
    upload_fixture,
)

# How long to wait for a background FFmpeg conversion job to finish.
JOB_TIMEOUT_S = 60
JOB_POLL_INTERVAL_S = 0.5


def _is_wav(raw: bytes) -> bool:
    return raw[:4] == b"RIFF" and raw[8:12] == b"WAVE"


def _is_flac(raw: bytes) -> bool:
    return raw[:4] == b"fLaC"


def _is_ogg(raw: bytes) -> bool:
    return raw[:4] == b"OggS"


def _is_mp3(raw: bytes) -> bool:
    # FFmpeg/libmp3lame output starts with an ID3 tag or a raw MPEG frame sync.
    if raw[:3] == b"ID3":
        return True
    return len(raw) >= 2 and raw[0] == 0xFF and (raw[1] & 0xE0) == 0xE0


def _is_m4a(raw: bytes) -> bool:
    # MP4/M4A container: the 'ftyp' box marker sits right after the size field.
    return raw[4:8] == b"ftyp"


# Target formats to exercise, paired with a validator for the downloaded bytes.
# Covers the default (mp3) plus a lossless, an alternative lossy, and a container
# format so the breadth of SUPPORTED_FORMATS in conversion_engine stays guarded.
FORMAT_CHECKS = [
    ("mp3", _is_mp3),
    ("wav", _is_wav),
    ("flac", _is_flac),
    ("ogg", _is_ogg),
    ("m4a", _is_m4a),
]


def _convert_one(conn: Conn, chk: Checks, cookie_header: str | None,
                 audio_id: str, fmt: str, validator) -> None:
    """Run start -> poll -> download for a single target format."""
    # 3. Start the conversion job.
    start_body = json.dumps({"audio_id": audio_id, "target_format": fmt}).encode("utf-8")
    status, raw, _, _, _ = conn.request(
        "POST",
        "/api/convert/start",
        cookie=cookie_header,
        body=start_body,
        content_type="application/json",
    )
    chk.expect(
        status == 200,
        f"[{fmt}] POST /api/convert/start -> 200",
        f"got {status}: {snip(raw)}",
    )
    job_id = json_field(raw, "job_id")
    chk.expect(bool(job_id), f"[{fmt}] start returns a job_id", f"body={snip(raw)}")
    if not job_id:
        return

    # 4. Poll the job status until it leaves the "running" state.
    deadline = time.time() + JOB_TIMEOUT_S
    final_status = None
    job_error = None
    while time.time() < deadline:
        status, raw, _, _, _ = conn.request(
            "GET", f"/api/convert/{job_id}/status", cookie=cookie_header
        )
        if status != 200:
            chk.expect(
                False,
                f"[{fmt}] GET /api/convert/{{id}}/status -> 200",
                f"got {status}: {snip(raw)}",
            )
            return
        final_status = json_field(raw, "status")
        job_error = json_field(raw, "error")
        if final_status in ("done", "failed"):
            break
        time.sleep(JOB_POLL_INTERVAL_S)

    chk.expect(
        final_status == "done",
        f"[{fmt}] conversion job reaches status=done",
        f"final status={final_status!r}, error={job_error!r}",
    )
    if final_status != "done":
        return

    # 5. Download the converted file and validate its bytes.
    status, raw, _, _, ctype = conn.request(
        "GET", f"/api/convert/{job_id}/download", cookie=cookie_header
    )
    chk.expect(
        status == 200,
        f"[{fmt}] GET /api/convert/{{id}}/download -> 200",
        f"got {status}: {snip(raw)}",
    )
    if status != 200:
        return
    chk.expect(
        len(raw) > 0,
        f"[{fmt}] converted file is non-empty",
        f"len={len(raw)}",
    )
    chk.expect(
        validator(raw),
        f"[{fmt}] converted file has valid {fmt} magic bytes",
        f"first bytes={raw[:12]!r}, content-type={ctype!r}",
    )


def run_flow(conn: Conn) -> Checks:
    chk = Checks()

    cookie_header = login(conn, chk)
    audio_id = upload_fixture(conn, chk, cookie_header)
    if not audio_id:
        # Without an audio_id the rest of the flow cannot proceed.
        return chk

    # 3-5. Convert to each target format and validate the downloaded result.
    for fmt, validator in FORMAT_CHECKS:
        _convert_one(conn, chk, cookie_header, audio_id, fmt, validator)

    return chk


def main() -> int:
    return run_standalone(
        "Driving upload -> convert -> download flow:", "CONVERT FLOW CHECK", run_flow
    )


if __name__ == "__main__":
    sys.exit(main())
