#!/usr/bin/env python3
"""Regression guard for the core value path: upload -> detect -> fetch.

This is a self-contained CI-style check (registered as the ``detect-flow``
validation step). It boots the real FastAPI backend in a throwaway uvicorn
subprocess and drives the app's core pipeline against it over HTTP, exercising
the non-production test-auth seam (see ``backend/auth.py``):

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
        c = http.client.HTTPConnection(HOST, self.port, timeout=120)
        headers: dict[str, str] = {}
        if cookie:
            headers["Cookie"] = cookie
        if content_type:
            headers["Content-Type"] = content_type
        c.request(method, path, body=body, headers=headers)
        resp = c.getresponse()
        raw = resp.read().decode("utf-8", "replace")
        status = resp.status
        set_cookies = resp.headers.get_all("Set-Cookie") or []
        location = resp.getheader("Location")
        c.close()
        return status, raw, set_cookies, location


def _wait_for_boot(conn: Conn) -> None:
    deadline = time.time() + BOOT_TIMEOUT_S
    last_err = "no response"
    while time.time() < deadline:
        try:
            status, _, _, _ = conn.request("GET", "/health")
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


def _json_field(raw: str, key: str):
    try:
        return json.loads(raw).get(key)
    except Exception:
        return None


def run_flow(conn: Conn) -> Checks:
    chk = Checks()

    # 1. Log in via the test seam to get an authenticated cookie.
    status, _, set_cookies, _ = conn.request(
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
    status, raw, _, _ = conn.request(
        "POST", "/api/audio/upload", cookie=cookie_header, body=body, content_type=content_type
    )
    chk.expect(status == 200, "POST /api/audio/upload -> 200", f"got {status}: {raw[:300]}")
    audio_id = _json_field(raw, "audio_id")
    chk.expect(bool(audio_id), "upload returns an audio_id", f"body={raw[:300]}")

    if not audio_id:
        # Without an audio_id the rest of the flow cannot proceed.
        return chk

    # 3. Detect hits for the uploaded audio.
    detect_body = json.dumps({"audio_id": audio_id}).encode("utf-8")
    status, raw, _, _ = conn.request(
        "POST",
        "/api/detection/detect",
        cookie=cookie_header,
        body=detect_body,
        content_type="application/json",
    )
    chk.expect(status == 200, "POST /api/detection/detect -> 200", f"got {status}: {raw[:300]}")
    detection_id = _json_field(raw, "detection_id")
    chk.expect(bool(detection_id), "detect returns a detection_id", f"body={raw[:300]}")
    total_hits = _json_field(raw, "total_hits") or 0
    chk.expect(total_hits > 0, "detect returns at least one hit", f"total_hits={total_hits}")

    if not detection_id:
        return chk

    # 4. Fetch the persisted detection back.
    status, raw, _, _ = conn.request(
        "GET", f"/api/detection/{detection_id}", cookie=cookie_header
    )
    chk.expect(status == 200, "GET /api/detection/{id} -> 200", f"got {status}: {raw[:300]}")
    chk.expect(
        _json_field(raw, "detection_id") == detection_id,
        "fetched detection id matches",
        f"body={raw[:300]}",
    )
    try:
        hits = json.loads(raw).get("hits") or []
    except Exception:
        hits = []
    chk.expect(len(hits) > 0, "fetched detection contains hits", f"hits={len(hits)}")

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

        print("Backend healthy. Driving upload -> detect -> fetch flow:\n")
        chk = run_flow(conn)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()

    print()
    if chk.failures:
        print(f"DETECT FLOW CHECK FAILED: {len(chk.failures)} of "
              f"{chk.passed + len(chk.failures)} assertions failed:")
        for f in chk.failures:
            print(f"  - {f}")
        return 1

    print(f"DETECT FLOW CHECK PASSED: all {chk.passed} assertions passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
