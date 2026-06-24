"""Replit Auth — header-based authentication (with a test-only seam).

When the app is served through the Replit proxy, an authenticated request
carries the following headers injected by the platform:
  - X-Replit-User-Id            : stable unique user id
  - X-Replit-User-Name          : username / display name
  - X-Replit-User-Profile-Image : URL to the user's avatar

The frontend kicks off the login flow by redirecting the browser to
https://replit.com/auth_with_replit_new?domain=<host>. After the user logs in,
the proxy adds these headers to every request, and we identify the user from
them. If the id header is missing, the request is unauthenticated.

Test-only seam
--------------
The automated browser test harness has no Replit ``REPL_AUTH`` cookie, so the
proxy never injects the ``X-Replit-User-*`` headers and the test browser is
permanently logged-out. To make the full login → logout flow testable, we accept
a non-Replit fallback cookie (:data:`TEST_AUTH_COOKIE`) **only when the app is
not running as a production deployment** (see :func:`test_auth_enabled`). A test
can establish an authenticated session by visiting ``/api/__test/login`` and
then exercise the real logout button. Real production traffic always
authenticates via the proxy headers; the seam is inert there.
"""
import os
from dataclasses import dataclass
from typing import Optional

from fastapi import Cookie, Header, HTTPException


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


def get_current_user(
    x_replit_user_id: Optional[str] = Header(default=None),
    x_replit_user_name: Optional[str] = Header(default=None),
    x_replit_user_profile_image: Optional[str] = Header(default=None),
    dt_test_user: Optional[str] = Cookie(default=None),
) -> User:
    """FastAPI dependency that returns the authenticated user or raises 401."""
    if x_replit_user_id:
        return User(
            id=x_replit_user_id,
            name=x_replit_user_name or x_replit_user_id,
            profile_image=x_replit_user_profile_image,
        )

    # Test-only fallback — never reachable in a production deployment.
    if test_auth_enabled() and dt_test_user:
        return User(id=f"test:{dt_test_user}", name=dt_test_user, profile_image=None)

    raise HTTPException(status_code=401, detail="Not authenticated")
