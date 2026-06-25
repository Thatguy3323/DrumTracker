#!/usr/bin/env python3
"""Shared harness for the CI-style flow regression guards.

The individual ``check_*_flow.py`` scripts used to each boot their OWN full
FastAPI backend in a throwaway uvicorn subprocess. Because the backend imports
torch / open-unmix / essentia at startup, every boot costs several seconds, and
a full validation run paid that cost once per check.

This module factors out the duplicated machinery so the backend can be booted
ONCE and every flow driven against it (see ``check_all_flows.py``):

  * boot + health-wait (``running_backend`` context manager)
  * the tiny stdlib HTTP client (``Conn``)
  * assertion bookkeeping (``Checks``)
  * cookie / multipart / JSON parsing helpers
  * the shared login -> upload -> detect steps that most flows depend on

Each flow's assertions live in its own ``check_*_flow.py`` module as a
``run_flow(conn) -> Checks`` function, so the flows stay independently runnable
(``python scripts/check_detect_flow.py``) while the combined runner reuses the
exact same logic against a single backend.
"""
from __future__ import annotations

import http.client
import json
import os
import socket
import subprocess
import sys
import threading
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Callable, Iterator, TextIO

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
    """Tiny stdlib HTTP helper.

    Bodies are returned as raw bytes so binary exports (MIDI/ZIP/WAV/converted
    audio) survive intact; text callers decode as needed. Using the stdlib
    directly means we never pull extra deps into the checks and never
    auto-replay/refuse Secure cookies the way a full client would.
    """

    def __init__(self, port: int) -> None:
        self.port = port

    def request(
        self,
        method: str,
        path: str,
        cookie: str | None = None,
        body: bytes | None = None,
        content_type: str | None = None,
    ) -> tuple[int, bytes, list[str], str | None, str | None]:
        """Return ``(status, raw_bytes, set_cookies, location, content_type)``."""
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


# Per-thread output sink. When the combined runner drives flows concurrently it
# binds each flow's output to its own buffer here so the live PASS/FAIL lines
# don't interleave across threads; the runner then prints each buffer grouped
# under its flow header. Defaults to stdout (the standalone, single-flow path).
_thread_output = threading.local()


def set_thread_output(stream: TextIO | None) -> None:
    """Bind (or, with ``None``, unbind) the current thread's output sink."""
    _thread_output.stream = stream


def _out() -> TextIO:
    return getattr(_thread_output, "stream", None) or sys.stdout


class Checks:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.passed = 0

    def expect(self, ok: bool, label: str, detail: str = "") -> None:
        if ok:
            self.passed += 1
            print(f"  PASS  {label}", file=_out())
        else:
            self.failures.append(f"{label} -- {detail}")
            print(f"  FAIL  {label} -- {detail}", file=_out())


def cookie_value(set_cookies: list[str], name: str) -> str | None:
    for sc in set_cookies:
        first = sc.split(";", 1)[0].strip()
        if first.startswith(f"{name}="):
            return first[len(name) + 1 :]
    return None


def clears_cookie(set_cookies: list[str], name: str) -> bool:
    for sc in set_cookies:
        if not sc.split(";", 1)[0].strip().startswith(f"{name}="):
            continue
        low = sc.lower()
        if "max-age=0" in low or "1970" in low or "expires=thu, 01 jan 1970" in low:
            return True
    return False


def multipart(field: str, filename: str, data: bytes, mime: str) -> tuple[bytes, str]:
    boundary = f"----dtboundary{uuid.uuid4().hex}"
    pre = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode("utf-8")
    post = f"\r\n--{boundary}--\r\n".encode("utf-8")
    return pre + data + post, f"multipart/form-data; boundary={boundary}"


def json_field(raw: bytes, key: str):
    try:
        return json.loads(raw.decode("utf-8", "replace")).get(key)
    except Exception:
        return None


def snip(raw: bytes, n: int = 300) -> str:
    return raw[:n].decode("utf-8", "replace")


# --------------------------------------------------------------------------- #
# Shared flow steps                                                           #
# --------------------------------------------------------------------------- #
# login -> upload -> detect is the common prefix that most flows depend on.
# Each flow still calls these against the (shared) backend so its assertions
# are preserved exactly as before.


def login(conn: Conn, chk: Checks) -> str | None:
    """Log in via the non-production test seam; return the cookie header."""
    status, _, set_cookies, _, _ = conn.request(
        "GET", f"/api/__test/login?username={USERNAME}"
    )
    chk.expect(status == 302, "login GET /api/__test/login -> 302", f"got {status}")
    val = cookie_value(set_cookies, TEST_COOKIE)
    chk.expect(val == USERNAME, f"login sets {TEST_COOKIE} cookie", f"got {val!r}")
    return f"{TEST_COOKIE}={val}" if val else None


def upload_fixture(conn: Conn, chk: Checks, cookie_header: str | None) -> str | None:
    """Upload the bundled audio fixture; return the audio_id (or None)."""
    body, content_type = multipart(
        "file", FIXTURE.name, FIXTURE.read_bytes(), "audio/mpeg"
    )
    status, raw, _, _, _ = conn.request(
        "POST", "/api/audio/upload", cookie=cookie_header, body=body, content_type=content_type
    )
    chk.expect(status == 200, "POST /api/audio/upload -> 200", f"got {status}: {snip(raw)}")
    audio_id = json_field(raw, "audio_id")
    chk.expect(bool(audio_id), "upload returns an audio_id", f"body={snip(raw)}")
    return audio_id


def detect(conn: Conn, chk: Checks, cookie_header: str | None, audio_id: str) -> str | None:
    """Run detection for the uploaded audio; return the detection_id (or None)."""
    detect_body = json.dumps({"audio_id": audio_id}).encode("utf-8")
    status, raw, _, _, _ = conn.request(
        "POST",
        "/api/detection/detect",
        cookie=cookie_header,
        body=detect_body,
        content_type="application/json",
    )
    chk.expect(status == 200, "POST /api/detection/detect -> 200", f"got {status}: {snip(raw)}")
    detection_id = json_field(raw, "detection_id")
    chk.expect(bool(detection_id), "detect returns a detection_id", f"body={snip(raw)}")
    total_hits = json_field(raw, "total_hits") or 0
    chk.expect(total_hits > 0, "detect returns at least one hit", f"total_hits={total_hits}")
    return detection_id


# --------------------------------------------------------------------------- #
# Backend lifecycle                                                           #
# --------------------------------------------------------------------------- #


class BackendBootError(RuntimeError):
    """Raised when the backend never becomes healthy; carries captured logs."""

    def __init__(self, message: str, logs: str = "") -> None:
        super().__init__(message)
        self.message = message
        self.logs = logs


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


@contextmanager
def running_backend() -> Iterator[Conn]:
    """Boot the real backend ONCE and yield a ``Conn`` to it.

    On boot failure raises ``BackendBootError`` (with the last of the captured
    backend logs attached). The subprocess is always torn down on exit.
    """
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
            logs = ""
            if proc.stdout is not None:
                try:
                    logs = proc.stdout.read()[-4000:]
                except Exception:
                    pass
            raise BackendBootError(str(e), logs)
        yield conn
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


def run_standalone(title: str, label: str, run_flow: Callable[[Conn], Checks]) -> int:
    """Boot the backend and drive a single flow (standalone-script entrypoint).

    Used by each ``check_*_flow.py`` so it stays runnable on its own. ``label``
    is the loud headline prefix, e.g. ``"AUTH FLOW CHECK"``.
    """
    if not FIXTURE.exists():
        print(f"ERROR: audio fixture not found at {FIXTURE}")
        return 2

    try:
        with running_backend() as conn:
            print(f"Backend healthy. {title}\n")
            chk = run_flow(conn)
    except BackendBootError as e:
        print(f"ERROR: {e.message}")
        if e.logs:
            print(e.logs)
        return 2

    print()
    if chk.failures:
        print(
            f"{label} FAILED: {len(chk.failures)} of "
            f"{chk.passed + len(chk.failures)} assertions failed:"
        )
        for f in chk.failures:
            print(f"  - {f}")
        return 1

    print(f"{label} PASSED: all {chk.passed} assertions passed.")
    return 0
