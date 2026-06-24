#!/usr/bin/env python3
"""Regression guard for the login -> logout flow.

This is a self-contained CI-style check (registered as the ``auth-flow``
validation step). It boots the real FastAPI backend in a throwaway uvicorn
subprocess and drives the complete authentication flow against it over HTTP,
exercising the non-production test-auth seam (see ``backend/auth.py``):

  1. logged-out      GET  /api/me                         -> 401
                     (the SPA renders the login screen when /api/me is 401)
  2. log in          GET  /api/__test/login?username=...   -> 302 to "/", sets
                     the dt_test_user cookie
  3. logged-in       GET  /api/me (with cookie)            -> 200, name matches
                     (the SPA renders the shell with the username + LOG OUT)
  4. log out         POST /api/logout                      -> 204 and emits
                     Set-Cookie headers that expire the auth cookies, which is
                     exactly what removes the session in the browser (the
                     cookie value carries no server-side session, so logout's
                     contract *is* clearing the cookie client-side)
  5. logged-out      GET  /api/me (no cookie)              -> 401
                     (the SPA is back on the login screen)

Any broken step fails loudly with a non-zero exit code so a future change to
auth can never silently break the flow.
"""
from __future__ import annotations

import http.client
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"

HOST = "127.0.0.1"
USERNAME = "ValidationBot"
BOOT_TIMEOUT_S = 60
TEST_COOKIE = "dt_test_user"


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, 0))
        return s.getsockname()[1]


class Conn:
    """Tiny stdlib HTTP helper so we never auto-replay/refuse Secure cookies."""

    def __init__(self, port: int) -> None:
        self.port = port

    def request(self, method: str, path: str, cookie: str | None = None):
        c = http.client.HTTPConnection(HOST, self.port, timeout=15)
        headers = {"Cookie": cookie} if cookie else {}
        c.request(method, path, headers=headers)
        resp = c.getresponse()
        body = resp.read().decode("utf-8", "replace")
        set_cookies = resp.headers.get_all("Set-Cookie") or []
        status = resp.status
        location = resp.getheader("Location")
        c.close()
        return status, body, set_cookies, location


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


def _clears_cookie(set_cookies: list[str], name: str) -> bool:
    for sc in set_cookies:
        if not sc.split(";", 1)[0].strip().startswith(f"{name}="):
            continue
        low = sc.lower()
        if "max-age=0" in low or "1970" in low or "expires=thu, 01 jan 1970" in low:
            return True
    return False


def run_flow(conn: Conn) -> Checks:
    chk = Checks()

    # 1. Logged-out: /api/me must be 401 (drives the login screen).
    status, _, _, _ = conn.request("GET", "/api/me")
    chk.expect(status == 401, "logged-out GET /api/me -> 401", f"got {status}")

    # 2. Log in via the test seam.
    status, _, set_cookies, location = conn.request(
        "GET", f"/api/__test/login?username={USERNAME}"
    )
    chk.expect(status == 302, "login GET /api/__test/login -> 302", f"got {status}")
    chk.expect(location == "/", "login redirects to /", f"Location={location!r}")
    cookie_val = _cookie_value(set_cookies, TEST_COOKIE)
    chk.expect(
        cookie_val == USERNAME,
        f"login sets {TEST_COOKIE} cookie",
        f"got {cookie_val!r}",
    )

    cookie_header = f"{TEST_COOKIE}={cookie_val}" if cookie_val else None

    # 3. Logged-in: /api/me must be 200 with the username (drives the shell:
    #    LOG OUT button + username visible).
    status, body, _, _ = conn.request("GET", "/api/me", cookie=cookie_header)
    chk.expect(status == 200, "logged-in GET /api/me -> 200", f"got {status}")
    chk.expect(
        f'"name":"{USERNAME}"' in body.replace(" ", ""),
        "logged-in /api/me returns the username",
        f"body={body!r}",
    )

    # 4. Log out: clears the auth cookies (this is what logs the browser out).
    status, _, logout_cookies, _ = conn.request(
        "POST", "/api/logout", cookie=cookie_header
    )
    chk.expect(status == 204, "POST /api/logout -> 204", f"got {status}")
    chk.expect(
        _clears_cookie(logout_cookies, TEST_COOKIE),
        f"logout expires the {TEST_COOKIE} cookie",
        f"Set-Cookie={logout_cookies!r}",
    )
    chk.expect(
        _clears_cookie(logout_cookies, "REPL_AUTH"),
        "logout expires the REPL_AUTH cookie",
        f"Set-Cookie={logout_cookies!r}",
    )

    # 5. Logged-out again: /api/me must be 401 (back to the login screen).
    status, _, _, _ = conn.request("GET", "/api/me")
    chk.expect(status == 401, "after-logout GET /api/me -> 401", f"got {status}")

    return chk


def main() -> int:
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

        print("Backend healthy. Driving login -> logout flow:\n")
        chk = run_flow(conn)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()

    print()
    if chk.failures:
        print(f"AUTH FLOW CHECK FAILED: {len(chk.failures)} of "
              f"{chk.passed + len(chk.failures)} assertions failed:")
        for f in chk.failures:
            print(f"  - {f}")
        return 1

    print(f"AUTH FLOW CHECK PASSED: all {chk.passed} assertions passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
