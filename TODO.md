# TODO

## High Priority

- [x] **Remove `SESSION_SECRET` from `.env`** — defined but never used anywhere in the codebase; creates confusion about what's required
- [x] **Fix error handler to respect `err.status`** — currently always returns 500; should check `err.status` / `err.statusCode` before defaulting (`src/middleware/errorHandler/errorHandler.ts`)
- [x] **Add graceful shutdown timeout** — `server.close()` has no timeout; if a client keeps a connection open, the process hangs indefinitely (`src/index.ts` shutdown function)
- [x] **Fix request timeout to abort handler** — `res.setTimeout()` sends a 408 but the handler keeps executing in the background; add `req.destroy()` to actually cancel the request (`src/index.ts`)
- [x] **Make `SESSION_COOKIE_OPTIONS.secure` dynamic** — `secure: isProduction()` is evaluated once at import time; if `NODE_ENV` isn't set when the module loads (e.g., tests), the value is frozen incorrectly; compute per-request instead (`src/handlers/auth/auth.ts`)

## Medium Priority

- [x] **Allow concurrent sessions on login** — `loginUser()` deletes ALL sessions for the user on every login, so logging in on one device kicks all others; change to only delete expired sessions (`src/repositories/auth/auth.ts`)
- [x] **Wire up expired session cleanup** — `deleteExpiredSessions()` exists but is never called; expired sessions accumulate in the DB; add a `setInterval` in the entry module or document a cron job
- [x] **Move health check before `loadSession` middleware** — health endpoint currently triggers a DB session lookup on every probe; move it above `loadSession` in the middleware stack (`src/index.ts`)
- [x] **Add health check caching** — health endpoint does a DB round-trip on every call; cache the result for a few seconds to reduce pool pressure under heavy probing
- [x] **Remove dead rate limiter config** — `RATE_LIMIT_STORAGE_URI` env var is warned about in production but never actually used to create a Redis store; either implement it or remove the warning and env var reference (`src/middleware/rateLimiter/rateLimiter.ts`)
- [x] **Update `.env.example` completeness** — add `DATABASE_SSL_REJECT_UNAUTHORIZED` (used in `pool.ts` but not documented)

## Low Priority

- [x] **Add Dockerfile** — no containerization story; add a multi-stage Dockerfile for production deployment
- [x] **Remove unused dependencies** — audit `package.json` for any dev dependencies not referenced in scripts or config (e.g., check if `nodemon` is present but unused)

## Security (existing)

- [ ] Wire up Redis-backed rate limiter — set `RATE_LIMIT_STORAGE_URI` in production; the in-memory store does not work behind a load balancer (SECURITY.md §5)
- [ ] Add account lockout / progressive delays after repeated login failures, with notification to the account owner (SECURITY.md §5)
- [ ] Enforce HTTPS and HSTS at the reverse proxy level (Nginx/Cloudflare); set `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (SECURITY.md §3, §11)
- [ ] Restrict TLS to 1.2+ at the reverse proxy; disable TLS 1.0/1.1 and SSL (SECURITY.md §11)
