"""Replit Auth — OpenID Connect (OIDC) session-based authentication.

The app authenticates users through Replit's OIDC provider
(``https://replit.com/oidc``). The login/callback handshake lives in
``main.py``; once a user has logged in, their stable OIDC ``sub`` id is stored
in a signed, HttpOnly session cookie (Starlette ``SessionMiddleware``). Every
request resolves the user by reading ``user_id`` from that session and loading
the persisted profile from the ``users`` table.

We intentionally do **not** trust the legacy ``X-Replit-User-*`` proxy headers:
those are injected by the proxy edge and can be spoofed on a direct request to
the backend, so honoring them would let an attacker bypass the OIDC flow.

Test-only seam
--------------
The automated browser/HTTP test harness cannot perform the real OIDC handshake,
so it would be permanently logged-out. To keep the full login -> logout flow
testable, we accept a non-OIDC fallback cookie (:data:`TEST_AUTH_COOKIE`) **only
when the app is not running as a production deployment** (see
:func:`test_auth_enabled`). A test establishes a session by visiting
``/api/__test/login`` and then exercises the real logout button. Production
traffic always authenticates via OIDC; the seam is inert there.
"""
import os
from dataclasses import dataclass
from typing import Optional

from fastapi import Cookie, HTTPException, Request

from database import get_user


# Name of the fallback cookie used by the test-only auth seam.
TEST_AUTH_COOKIE = "dt_test_user"


def test_auth_enabled() -> bool:
    """Whether the test-only auth seam is active.

    It is active everywhere except production deployments. Replit sets
    ``REPLIT_DEPLOYMENT=1`` in deployed (production) environments and leaves it
    unset in development, so the seam can never authenticate a real production
    request.
    """
    return os.environ.get("REPLIT_DEPLOYMENT") != "1"


@dataclass
class User:
    id: str
    name: str
    profile_image: Optional[str] = None


def _display_name(profile: dict) -> str:
    """Build a human-friendly name from OIDC profile fields."""
    first = (profile.get("first_name") or "").strip()
    last = (profile.get("last_name") or "").strip()
    full = " ".join(p for p in (first, last) if p)
    return full or profile.get("email") or profile.get("id") or "User"


def get_current_user(
    request: Request,
    dt_test_user: Optional[str] = Cookie(default=None),
) -> User:
    """FastAPI dependency that returns the authenticated user or raises 401.

    Resolution order:
      1. A real OIDC session — ``user_id`` in the signed session cookie, whose
         profile is loaded from the ``users`` table.
      2. The test-only seam — the ``dt_test_user`` cookie, honored only outside
         production deployments.
    """
    user_id = request.session.get("user_id")
    if user_id:
        profile = get_user(user_id)
        if profile:
            return User(
                id=profile["id"],
                name=_display_name(profile),
                profile_image=profile.get("profile_image_url"),
            )
        # Stale session pointing at a deleted user — drop it so the client
        # re-authenticates cleanly instead of looping on a phantom session.
        request.session.pop("user_id", None)

    # Test-only fallback — never reachable in a production deployment.
    if test_auth_enabled() and dt_test_user:
        return User(id=f"test:{dt_test_user}", name=dt_test_user, profile_image=None)

    raise HTTPException(status_code=401, detail="Not authenticated")
