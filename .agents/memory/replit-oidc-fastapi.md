---
name: Replit Auth (OIDC) on FastAPI
description: How to adapt Replit's "Log in with Replit" OIDC to FastAPI; the redirect_uri and cookie gotchas that bite under the Vite proxy.
---

# Replit Auth (OIDC) on a FastAPI backend

The official Replit Auth blueprint ships a **Flask** implementation and is NOT
usable directly on FastAPI. The working FastAPI-native equivalent is **Authlib's
Starlette client + Starlette `SessionMiddleware`**.

Key shape (public client, auth-only, no token storage):
- `oauth.register(name='replit', client_id=REPL_ID, server_metadata_url=f"{ISSUER}/.well-known/openid-configuration", client_kwargs={scope:'openid profile email', code_challenge_method:'S256', token_endpoint_auth_method:'none'})`.
- `ISSUER` default is `https://replit.com/oidc` (override via `ISSUER_URL`).
- `/api/login`: `session.clear()` → `authorize_redirect`. `/api/callback`: `authorize_access_token()` (validates state+PKCE+nonce), claims = `token['userinfo']`, require `sub`, then `session.clear()` + set `session['user_id']`. The double clear is the session-fixation defence.
- Replit-custom claims `first_name`/`last_name`/`profile_image_url` come back inside `token['userinfo']` alongside `sub`/`email`.

## Gotchas (the non-obvious part)
- **redirect_uri MUST be env-derived, never from the request Host.** The Vite dev
  proxy uses `changeOrigin`, so the backend sees `Host: localhost:8080`. Build it
  from `REPLIT_DOMAINS` (deployments) or `REPLIT_DEV_DOMAIN` (dev): strip
  scheme/trailing slash → `https://{domain}/api/callback`.
- **The Replit edge proxy rewrites the session cookie to `SameSite=None; Secure`**
  (for preview-iframe compatibility) even if `SessionMiddleware` is set to
  `same_site='lax'`. This is fine: the OIDC callback is a top-level redirect, so
  both Lax and None are sent — the handshake still works.
- `SESSION_SECRET`, `REPL_ID`, `REPLIT_DOMAINS`, `REPLIT_DEV_DOMAIN` are all
  platform-injected. `REPLIT_DEPLOYMENT=1` only in production.

**Why:** these three (Flask-vs-FastAPI, Host masking, edge cookie rewrite) each
cost real debugging time and none are discoverable from reading the final code.

## Legacy → OIDC continuity
When migrating OFF the legacy `X-Replit-User-*` header auth, the user id changes
from the header user-id to the OIDC `sub`. Per-user rows keyed by the old id stay
invisible unless `sub == old id`. If a repl already had real users, a backfill is
needed — but it's a separate migration, not part of the auth swap.
