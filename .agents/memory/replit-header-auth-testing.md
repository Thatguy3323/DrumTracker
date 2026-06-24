---
name: Header-based Replit auth testing
description: How the logged-in→logout browser flow is made automatable under legacy header-based Replit auth via a non-production test login seam.
---

# Testing header-based Replit auth

This project authenticates via the **legacy header-based Replit auth**: the Replit
proxy injects `X-Replit-User-*` headers when a `REPL_AUTH` cookie is present; the
backend returns 401 when the id header is missing. Login is a full redirect to
`replit.com/auth_with_replit_new`.

**Constraint:** the `runTest` (Playwright) browser does NOT carry the project
owner's `REPL_AUTH` cookie, so it can never be authenticated by the proxy. The
testing skill's `testReplitAuth: true` only works for **OIDC** Replit auth, not
this header-based variant, and the `REPL_AUTH` token is signed by the proxy so it
can't be faked.

**Solution — non-production test login seam:** `auth.get_current_user` accepts a
fallback cookie (`dt_test_user`) **only when not a production deployment**
(`REPLIT_DEPLOYMENT != "1"`, see `auth.test_auth_enabled()`). A test establishes
an authenticated session by browser-navigating to `GET /api/__test/login`
(optionally `?username=`), which sets that cookie and 302-redirects to `/`. The
endpoint returns 404 in production, so the seam can never bypass real auth there.
`/api/logout` clears the seam cookie too, so the real LOG OUT button returns the
test browser to a genuinely logged-out state.

**Why:** real header auth has no programmatic-login override; the seam is the
test-only escape hatch so the full login→logout→re-login path is automatable.

**How to apply (test plan):**
- logged-out: navigate `/` → login button present, no logout button; `GET /api/me` → 401
- log in: browser-navigate `/api/__test/login?username=<name>` (a `[Browser]` step,
  not `[API]` — the cookie must land in the page's context); shell shows LOG OUT + name
- log out: click LOG OUT → back to login screen; `GET /api/me` → 401
- re-login prompt: click "Log in with Replit" → navigates toward a URL containing
  `auth_with_replit_new`
