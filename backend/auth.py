"""Replit Auth — header-based authentication.

When the app is served through the Replit proxy, an authenticated request
carries the following headers injected by the platform:
  - X-Replit-User-Id            : stable unique user id
  - X-Replit-User-Name          : username / display name
  - X-Replit-User-Profile-Image : URL to the user's avatar

The frontend kicks off the login flow by redirecting the browser to
https://replit.com/auth_with_replit_new?domain=<host>. After the user logs in,
the proxy adds these headers to every request, and we identify the user from
them. If the id header is missing, the request is unauthenticated.
"""
from dataclasses import dataclass
from typing import Optional

from fastapi import Header, HTTPException


@dataclass
class User:
    id: str
    name: str
    profile_image: Optional[str] = None


def get_current_user(
    x_replit_user_id: Optional[str] = Header(default=None),
    x_replit_user_name: Optional[str] = Header(default=None),
    x_replit_user_profile_image: Optional[str] = Header(default=None),
) -> User:
    """FastAPI dependency that returns the authenticated user or raises 401."""
    if not x_replit_user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return User(
        id=x_replit_user_id,
        name=x_replit_user_name or x_replit_user_id,
        profile_image=x_replit_user_profile_image,
    )
