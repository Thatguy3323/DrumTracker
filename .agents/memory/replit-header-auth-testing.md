---
name: Header-based Replit auth testing
description: Why the logged-in→logout browser path can't be automated under legacy header-based Replit auth, and what IS verifiable.
---

# Testing header-based Replit auth

This project authenticates via the **legacy header-based Replit auth**: the Replit
proxy injects `X-Replit-User-*` headers when a `REPL_AUTH` cookie is present; the
backend returns 401 when the id header is missing. Login is a full redirect to
`replit.com/auth_with_replit_new`.

**Constraint:** the `runTest` (Playwright) browser does NOT carry the project
owner's `REPL_AUTH` cookie, so it always starts **logged-out** and `/api/me`
returns 401. There is no programmatic-login override for header auth — the
testing skill's `testReplitAuth: true` only works for **OIDC** Replit auth
(`python_log_in_with_replit` / `replit_auth.py`), not this header-based variant.
The `REPL_AUTH` token is signed/validated by the proxy, so it can't be faked.

**Why:** an attempt to test the full login→logout→re-login path failed at step 1
because the automated browser was unauthenticated — there's no way to establish
an authenticated session for this auth model from the test tool.

**How to apply:** for header-based Replit auth, do NOT try to assert the
logged-in shell or click a real "Log out" in an automated browser. Instead verify
the achievable surface:
- logged-out screen renders (login button present, no logout button)
- `GET /api/me` → 401
- `POST /api/logout` → 204 with `Set-Cookie` expiring `REPL_AUTH`
- clicking "Log in with Replit" navigates toward a URL containing
  `auth_with_replit_new` (proves re-login requires the auth prompt)

The logged-in→logout transition stays a manual check (or requires migrating to
OIDC auth to become automatable).
