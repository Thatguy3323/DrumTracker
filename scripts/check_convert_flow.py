#!/usr/bin/env python3
"""Regression guard for the format-conversion path: upload -> convert -> download.

This is a self-contained CI-style check (registered as the ``convert-flow``
validation step). It boots the real FastAPI backend in a throwaway uvicorn
subprocess and drives the app's FFmpeg conversion pipeline against it over HTTP,
exercising the non-production test-auth seam (see ``backend/auth.py``):

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
"""
from __future__ import annotations

import http.client
import json
import os
import socket
import subprocess
import sys
import time
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
FIXTURE = REPO_ROOT / "drumtracker_audio.mp3"

HOST = "127.0.0.1"
USERNAME = "ValidationBot"
BOOT_TIMEOUT_S = 60
TEST_COOKIE = "dt_test_user"

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


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, 0))
        return s.getsockname()[1]


class Conn:
    """Tiny stdlib HTTP helper (avoids pulling extra deps into the check)."""

    def __init__(self, port: int) -> None:
        self.port = port

    def request(
        self,
        method: str,
        path: str,
        cookie: str | None = None,
        body: bytes | None = None,
        content_type: str | None = None,
    ):
        """Return (status, raw_bytes, set_cookies, location, content_type).

        Bodies are returned as raw bytes so binary downloads survive intact;
        text callers decode as needed.
        """
        c = http.client.HTTPConnection(HOST, self.port, timeout=120)
        headers: dict[str, str] = {}
        if cookie:
            headers["Cookie"] = cookie
        if content_type:
            headers["Content-Type"] = content_type
        c.request(method, path, body=body, headers=headers)
        resp = c.getresponse()
        raw = resp.read()
        status = resp.status
        set_cookies = resp.headers.get_all("Set-Cookie") or []
        location = resp.getheader("Location")
        content_type_hdr = resp.getheader("Content-Type")
        c.close()
        return status, raw, set_cookies, location, content_type_hdr


def _wait_for_boot(conn: Conn) -> None:
    deadline = time.time() + BOOT_TIMEOUT_S
    last_err = "no response"
    while time.time() < deadline:
        try:
            status, _, _, _, _ = conn.request("GET", "/health")
            if status == 200:
                return
            last_err = f"/health returned {status}"
        except Exception as e:  # connection refused while booting
            last_err = str(e)
        time.sleep(0.5)
    raise RuntimeError(f"backend did not become healthy within {BOOT_TIMEOUT_S}s: {last_err}")


class Checks:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.passed = 0

    def expect(self, ok: bool, label: str, detail: str = "") -> None:
        if ok:
            self.passed += 1
            print(f"  PASS  {label}")
        else:
            self.failures.append(f"{label} -- {detail}")
            print(f"  FAIL  {label} -- {detail}")


def _cookie_value(set_cookies: list[str], name: str) -> str | None:
    for sc in set_cookies:
        first = sc.split(";", 1)[0].strip()
        if first.startswith(f"{name}="):
            return first[len(name) + 1 :]
    return None


def _multipart(field: str, filename: str, data: bytes, mime: str) -> tuple[bytes, str]:
    boundary = f"----dtboundary{uuid.uuid4().hex}"
    pre = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode("utf-8")
    post = f"\r\n--{boundary}--\r\n".encode("utf-8")
    return pre + data + post, f"multipart/form-data; boundary={boundary}"


def _json_field(raw: bytes, key: str):
    try:
        return json.loads(raw.decode("utf-8", "replace")).get(key)
    except Exception:
        return None


def _snip(raw: bytes, n: int = 300) -> str:
    return raw[:n].decode("utf-8", "replace")


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
        f"got {status}: {_snip(raw)}",
    )
    job_id = _json_field(raw, "job_id")
    chk.expect(bool(job_id), f"[{fmt}] start returns a job_id", f"body={_snip(raw)}")
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
                f"got {status}: {_snip(raw)}",
            )
            return
        final_status = _json_field(raw, "status")
        job_error = _json_field(raw, "error")
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
        f"got {status}: {_snip(raw)}",
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

    # 1. Log in via the test seam to get an authenticated cookie.
    status, _, set_cookies, _, _ = conn.request(
        "GET", f"/api/__test/login?username={USERNAME}"
    )
    chk.expect(status == 302, "login GET /api/__test/login -> 302", f"got {status}")
    cookie_val = _cookie_value(set_cookies, TEST_COOKIE)
    chk.expect(cookie_val == USERNAME, f"login sets {TEST_COOKIE} cookie", f"got {cookie_val!r}")
    cookie_header = f"{TEST_COOKIE}={cookie_val}" if cookie_val else None

    # 2. Upload the bundled audio fixture.
    body, content_type = _multipart(
        "file", FIXTURE.name, FIXTURE.read_bytes(), "audio/mpeg"
    )
    status, raw, _, _, _ = conn.request(
        "POST", "/api/audio/upload", cookie=cookie_header, body=body, content_type=content_type
    )
    chk.expect(status == 200, "POST /api/audio/upload -> 200", f"got {status}: {_snip(raw)}")
    audio_id = _json_field(raw, "audio_id")
    chk.expect(bool(audio_id), "upload returns an audio_id", f"body={_snip(raw)}")

    if not audio_id:
        # Without an audio_id the rest of the flow cannot proceed.
        return chk

    # 3-5. Convert to each target format and validate the downloaded result.
    for fmt, validator in FORMAT_CHECKS:
        _convert_one(conn, chk, cookie_header, audio_id, fmt, validator)

    return chk


def main() -> int:
    if not FIXTURE.exists():
        print(f"ERROR: audio fixture not found at {FIXTURE}")
        return 2

    port = _free_port()
    env = dict(os.environ)
    # The test-auth seam is active only when this is NOT a production deployment.
    env.pop("REPLIT_DEPLOYMENT", None)

    print(f"Booting backend on {HOST}:{port} ...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", HOST, "--port", str(port)],
        cwd=str(BACKEND_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    conn = Conn(port)
    try:
        try:
            _wait_for_boot(conn)
        except Exception as e:
            print(f"ERROR: {e}")
            if proc.stdout is not None:
                try:
                    print(proc.stdout.read()[-4000:])
                except Exception:
                    pass
            return 2

        print("Backend healthy. Driving upload -> convert -> download flow:\n")
        chk = run_flow(conn)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()

    print()
    if chk.failures:
        print(f"CONVERT FLOW CHECK FAILED: {len(chk.failures)} of "
              f"{chk.passed + len(chk.failures)} assertions failed:")
        for f in chk.failures:
            print(f"  - {f}")
        return 1

    print(f"CONVERT FLOW CHECK PASSED: all {chk.passed} assertions passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
