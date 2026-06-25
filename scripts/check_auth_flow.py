#!/usr/bin/env python3
"""Regression guard for the login -> logout flow.

This is a CI-style check (registered as part of the ``flows`` validation step).
It drives the complete authentication flow over HTTP against the real FastAPI
backend, exercising the non-production test-auth seam (see ``backend/auth.py``):

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

The backend boot/HTTP/cookie machinery lives in ``flow_harness`` so a single
combined run (``check_all_flows.py``) can boot the backend once and drive every
flow against it; this script stays independently runnable for debugging.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from flow_harness import (  # noqa: E402
    TEST_COOKIE,
    USERNAME,
    Checks,
    Conn,
    clears_cookie,
    cookie_value,
    run_standalone,
)


def run_flow(conn: Conn) -> Checks:
    chk = Checks()

    # 1. Logged-out: /api/me must be 401 (drives the login screen).
    status, _, _, _, _ = conn.request("GET", "/api/me")
    chk.expect(status == 401, "logged-out GET /api/me -> 401", f"got {status}")

    # 2. Log in via the test seam.
    status, _, set_cookies, location, _ = conn.request(
        "GET", f"/api/__test/login?username={USERNAME}"
    )
    chk.expect(status == 302, "login GET /api/__test/login -> 302", f"got {status}")
    chk.expect(location == "/", "login redirects to /", f"Location={location!r}")
    cookie_val = cookie_value(set_cookies, TEST_COOKIE)
    chk.expect(
        cookie_val == USERNAME,
        f"login sets {TEST_COOKIE} cookie",
        f"got {cookie_val!r}",
    )

    cookie_header = f"{TEST_COOKIE}={cookie_val}" if cookie_val else None

    # 3. Logged-in: /api/me must be 200 with the username (drives the shell:
    #    LOG OUT button + username visible).
    status, raw, _, _, _ = conn.request("GET", "/api/me", cookie=cookie_header)
    body = raw.decode("utf-8", "replace")
    chk.expect(status == 200, "logged-in GET /api/me -> 200", f"got {status}")
    chk.expect(
        f'"name":"{USERNAME}"' in body.replace(" ", ""),
        "logged-in /api/me returns the username",
        f"body={body!r}",
    )

    # 4. Log out: clears the auth cookies (this is what logs the browser out).
    status, _, logout_cookies, _, _ = conn.request(
        "POST", "/api/logout", cookie=cookie_header
    )
    chk.expect(status == 204, "POST /api/logout -> 204", f"got {status}")
    chk.expect(
        clears_cookie(logout_cookies, TEST_COOKIE),
        f"logout expires the {TEST_COOKIE} cookie",
        f"Set-Cookie={logout_cookies!r}",
    )
    chk.expect(
        clears_cookie(logout_cookies, "REPL_AUTH"),
        "logout expires the REPL_AUTH cookie",
        f"Set-Cookie={logout_cookies!r}",
    )

    # 5. Logged-out again: /api/me must be 401 (back to the login screen).
    status, _, _, _, _ = conn.request("GET", "/api/me")
    chk.expect(status == 401, "after-logout GET /api/me -> 401", f"got {status}")

    return chk


def main() -> int:
    return run_standalone(
        "Driving login -> logout flow:", "AUTH FLOW CHECK", run_flow
    )


if __name__ == "__main__":
    sys.exit(main())
