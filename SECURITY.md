# Security Requirements for a Production-Ready Express REST Backend

---

## 1. Authentication

- Enforce authentication on all routes unless explicitly marked as public. Use a middleware-first approach so new routes are protected by default and public routes are the explicit opt-in.
- Use short-lived JWTs for access tokens (e.g., 15 minutes) and long-lived, HTTP-only, secure refresh tokens stored in cookies. Never store tokens in localStorage or pass them via query parameters.
- Validate the JWT signature, expiration (`exp`), issuer (`iss`), and audience (`aud`) claims on every request. Use a well-maintained library (e.g., `jsonwebtoken`, `jose`) and keep signing keys rotated.
- Support token revocation for logout and credential compromise. Maintain a deny-list (e.g., in Redis with TTL matching token expiry) or use short-lived tokens with a refresh-token rotation strategy where each refresh token is single-use.
- Require re-authentication (password confirmation or step-up MFA) for sensitive operations: password change, email change, account deletion, role elevation.
- Hash passwords with a modern, adaptive algorithm (bcrypt with cost factor 12+, or argon2id). Never use MD5, SHA-1, or unsalted SHA-256.

## 2. Authorization

- Implement authorization as middleware or a policy layer, not as ad-hoc checks scattered inside route handlers. Every route should declare what role or permission it requires.
- Default to deny. If no permission is explicitly granted for a route or resource, the request should be rejected with a 403.
- Prevent IDOR (Insecure Direct Object Reference) on every endpoint that accepts a resource ID. Validate that the authenticated user has a legitimate ownership or membership relationship to the resource. Never rely solely on the presence of a valid JWT.
- Separate authentication middleware from authorization middleware. Authentication answers "who is this?"; authorization answers "can they do this?" Mixing them makes both harder to audit.
- Test authorization boundaries explicitly: can a regular user hit an admin endpoint? Can user A modify user B's resources by swapping an ID in the URL?

## 3. HTTP Security Headers

- Use Helmet (`helmet` npm package) as baseline middleware. It sets a strong default for most of the headers below, but verify each one is configured for your application's needs.
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`. Enforce HTTPS and prevent downgrade attacks.
- `Content-Security-Policy`: Set a restrictive policy. For an API-only server, `default-src 'none'` is appropriate. If the server renders any HTML (error pages, docs), tighten the policy to disallow inline scripts and restrict sources.
- `X-Content-Type-Options`: `nosniff`. Prevent the browser from MIME-sniffing responses away from the declared Content-Type.
- `X-Frame-Options`: `DENY` (or `SAMEORIGIN` if embedding is required). Prevent clickjacking.
- `Referrer-Policy`: `strict-origin-when-cross-origin` or `no-referrer`.
- `Permissions-Policy`: Disable browser features the API does not need (camera, microphone, geolocation, etc.).
- Remove the `X-Powered-By` header (Helmet does this by default). Do not advertise that the server runs Express.

## 4. Input Validation and Sanitization

- Validate every field of every request body, query parameter, URL parameter, and header that your application consumes. Use a schema validation library (e.g., Zod, Joi, express-validator) and reject requests that do not conform before they reach business logic.
- Enforce type, length, format, and range constraints. An `email` field should be validated as an email. A `limit` query parameter should be a positive integer within a defined range.
- Reject unexpected fields. If your endpoint accepts `{ name, email }`, a request containing `{ name, email, role: "admin" }` should either strip the extra field or reject the request entirely (mass assignment prevention).
- Sanitize string inputs that will be stored or rendered downstream to prevent stored XSS, even if the API itself does not render HTML.
- Never interpolate user input into SQL, shell commands, or template strings. Use parameterized queries (via your ORM or query builder) and avoid `child_process.exec` with user-controlled arguments.
- Validate `Content-Type` headers. If your endpoint expects `application/json`, reject requests with other content types to prevent content-type confusion attacks.

## 5. Rate Limiting and Brute Force Protection

- Apply global rate limiting at the IP level using a middleware like `express-rate-limit` backed by a shared store (Redis) in multi-instance deployments. The default in-memory store does not work behind a load balancer.
- Apply stricter, endpoint-specific rate limits on sensitive routes: login (`/auth/login`), registration, password reset, OTP verification. These should have much lower thresholds (e.g., 5 attempts per minute per IP) than general endpoints.
- Rate limit by authenticated user in addition to IP to prevent abuse from distributed IPs using a single compromised account.
- Return `429 Too Many Requests` with a `Retry-After` header. Do not include information about the exact threshold or remaining attempts in the response, as this helps attackers calibrate their approach.
- Consider a sliding-window or token-bucket algorithm instead of fixed-window counters to prevent burst abuse at window boundaries.
- For login endpoints specifically, implement progressive delays or account lockout after repeated failures, with a notification to the account owner.

## 6. CORS Configuration

- Never use `Access-Control-Allow-Origin: *` in production with credentialed requests. Whitelist specific frontend origins.
- Dynamically validate the `Origin` header against an allowlist. Do not reflect the request's `Origin` header back unconditionally, as this is equivalent to `*` with extra steps.
- Restrict `Access-Control-Allow-Methods` to only the HTTP methods your API actually uses (typically `GET, POST, PUT, PATCH, DELETE`).
- Restrict `Access-Control-Allow-Headers` to the headers your clients actually send (`Content-Type, Authorization`, etc.). Do not allow `*`.
- Set `Access-Control-Max-Age` to a reasonable value (e.g., 7200 seconds) to reduce preflight request volume.
- If your API does not serve browsers at all (server-to-server only), do not enable CORS. Omitting CORS headers entirely is the most secure option.

## 7. CSRF Protection

- If authentication uses cookies (session cookies or refresh tokens), enforce CSRF protection on all state-changing requests (POST, PUT, PATCH, DELETE).
- Set the `SameSite` attribute on all cookies to `Strict` (or `Lax` if cross-site navigation is required). This is the strongest single CSRF defense.
- Layer a CSRF token mechanism on top of `SameSite`: generate a per-session token, deliver it via a separate cookie or response body, and require it as a custom header (e.g., `X-CSRF-Token`) on every mutation request.
- If authentication is purely header-based (Bearer token in `Authorization` header, no cookies), CSRF is not a concern because browsers do not automatically attach custom headers. Verify this assumption holds and that no cookies are used for auth.

## 8. Request Size and Payload Limits

- Set a maximum request body size with `express.json({ limit: '1mb' })` (adjust to your needs). The Express default is 100KB, but be explicit.
- Set maximum URL length and header size limits at the reverse proxy level (Nginx, Cloudflare, etc.).
- For file upload endpoints, enforce file size limits, file count limits, and an allowlist of accepted MIME types. Use a library like `multer` with explicit `limits` configuration.
- Validate file contents, not just extensions or MIME types. A `.jpg` file extension does not guarantee the file is actually an image. Use magic bytes or a processing library to verify.
- Store uploaded files outside the web root, with randomized filenames, and serve them through a separate domain or CDN with restrictive `Content-Disposition` headers.
- Set request timeout at the server level (`server.setTimeout()`) and at the reverse proxy level. A request that hangs for 30+ seconds should be terminated.

## 9. Error Handling and Information Leakage

- Install a centralized error-handling middleware as the last middleware in the stack. Every unhandled error should flow through it.
- Never return raw stack traces, database error messages, or internal service details in production responses. Return a structured error with a user-facing message, an error code, and a correlation ID for support.
- Return consistent HTTP status codes. Use 401 for unauthenticated, 403 for unauthorized, 404 for not found, 422 for validation failures, 429 for rate limits, 500 for unexpected errors.
- Do not leak whether a resource exists through different error responses. For example, `GET /users/:id` should return the same 404 whether the user does not exist or the requester lacks permission, unless the requester is an admin.
- Do not leak whether an account exists via login or password-reset responses. "Invalid email or password" and "If an account with that email exists, we sent a reset link" are the correct patterns.
- Set `NODE_ENV=production` in production. Many libraries (including Express itself) change their error-reporting behavior based on this variable.

## 10. Session and Cookie Security

- Set all cookies with the following attributes: `HttpOnly` (prevents JavaScript access), `Secure` (HTTPS only), `SameSite=Strict` or `SameSite=Lax`, and a restrictive `Path`.
- Set the `Domain` attribute carefully. A cookie scoped to `.example.com` is accessible to all subdomains, including potentially compromised ones.
- Use short expiration times for session cookies. Refresh tokens should have a defined maximum lifetime (e.g., 7 to 30 days) and should be rotated on each use.
- Invalidate sessions server-side on logout. Clearing the cookie client-side is not sufficient if the server still accepts the token.
- If using express-session, use a production-ready session store (Redis, PostgreSQL) instead of the default in-memory store, which leaks memory and does not survive restarts.

## 11. Transport Security

- Enforce HTTPS for all traffic. Redirect HTTP to HTTPS at the reverse proxy or load balancer.
- Use TLS 1.2 as the minimum version. Prefer TLS 1.3. Disable older protocols (TLS 1.0, 1.1, SSL).
- If Express sits behind a reverse proxy (Nginx, AWS ALB, Cloudflare), set `app.set('trust proxy', 1)` (or the appropriate trust level) so that `req.ip`, `req.protocol`, and rate limiting work correctly with forwarded headers.
- Do not trust `X-Forwarded-For` or `X-Forwarded-Proto` headers unless `trust proxy` is configured correctly. Misconfiguration here allows IP spoofing and HTTPS detection bypasses.
- Use HSTS preloading for public-facing APIs. Submit your domain to the browser HSTS preload list.

## 12. Logging, Monitoring, and Auditing

- Log all authentication events (login success, login failure, logout, token refresh, password reset) with timestamp, user ID (if known), IP address, and user agent.
- Log all authorization failures with the user ID, requested resource, required permission, and the permission that was missing.
- Log request metadata for every request: method, path, status code, response time, request ID. Use a structured logging library (e.g., Pino, Winston) that outputs JSON for easy aggregation.
- Assign a unique request ID to every request (via middleware like `express-request-id` or a UUID generated in your logger). Include it in every log entry and return it in responses for correlation.
- Redact sensitive data from all logs: passwords, tokens, API keys, PII, request bodies on auth endpoints.
- Never log the full request body on endpoints that accept credentials or sensitive data.
- Set up alerts for anomalous patterns: spikes in 401/403 responses, unusual request volumes from a single IP, elevated 500 error rates, slow response times.
- Maintain an immutable audit trail for security-critical actions: role changes, permission grants, account deletions, data exports, admin actions.

## 13. Dependency and Supply Chain Security

- Pin all dependency versions. Commit your lockfile (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) to version control.
- Run `npm audit` (or equivalent) in CI on every build. Fail the build on critical or high-severity vulnerabilities.
- Use a tool like Socket, Snyk, or Dependabot for continuous monitoring of known vulnerabilities and supply chain attacks (typosquatting, maintainer account compromise, malicious postinstall scripts).
- Audit new dependencies before adding them. Check maintenance status, download trends, open issues, and whether the package runs postinstall scripts.
- Keep Express and its core middleware (`body-parser`, `cors`, `helmet`, `cookie-parser`) up to date. Security patches in these packages are critical.
- Minimize production dependencies. Do not install dev dependencies in production containers (`npm ci --omit=dev`).

## 14. Secrets Management

- Never hardcode API keys, database credentials, JWT signing secrets, or encryption keys in source code.
- Do not commit `.env` files to version control. Add `.env` to `.gitignore` and provide a `.env.example` with placeholder values.
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager, Doppler) or encrypted environment variables injected at deploy time.
- Use separate secrets for each environment (development, staging, production). A leaked dev secret must not grant access to production systems.
- Rotate secrets on a defined schedule and immediately after any suspected compromise. Design your application to handle secret rotation without downtime (e.g., accept both the old and new JWT signing key during a rotation window).

## 15. Database Security

- Connect to the database over TLS. Verify the server certificate.
- Use a dedicated database user for the application with the minimum necessary privileges. The application should not connect as a superuser or database owner.
- Use parameterized queries or an ORM for all database access. Never concatenate user input into query strings.
- Enable connection pooling with a sensible maximum pool size to prevent connection exhaustion under load or attack.
- Do not expose the database to the public internet. Place it in a private subnet accessible only from the application's network.
- Enable query logging at the database level (not in the application) for forensic purposes, with appropriate retention and access controls.
- Back up the database regularly and test restores. Encrypt backups at rest.

## 16. Denial of Service (DoS) Protection

- Set a global request timeout at the reverse proxy and at the Express server level. Kill requests that exceed the threshold.
- Use `express.json({ limit: '1mb' })` to reject oversized payloads before parsing.
- Protect against Slowloris and slow-read attacks at the reverse proxy level (Nginx and Cloudflare handle this natively; Node.js does not).
- Implement circuit breakers on calls to downstream services (databases, third-party APIs) so a slow dependency does not cascade into full unavailability.
- Use a reverse proxy or CDN (Nginx, Cloudflare, AWS WAF) as the first line of defense for volumetric attacks. Express should not be the internet-facing entry point.
- Limit the number of concurrent connections per IP if your infrastructure supports it.
- For CPU-intensive operations (e.g., password hashing, image processing), offload to a worker thread or queue to prevent event loop blocking.

## 17. API Versioning and Deprecation Security

- Version your API (`/v1/`, `/v2/`) so that security fixes can be deployed to new versions without breaking existing clients.
- Set a deprecation policy for old API versions. Retired versions should return `410 Gone`, not continue to serve traffic with outdated security.
- Do not maintain deprecated endpoints with known vulnerabilities. If a version cannot be patched, shut it down.

## 18. Response Security

- Set `Content-Type` headers explicitly on every response. Never rely on Express's default content-type negotiation for security-sensitive responses.
- For JSON API responses, always return `Content-Type: application/json`. This prevents browsers from interpreting responses as HTML and executing injected scripts.
- Do not include sensitive data in response headers (e.g., internal server names, version numbers, debug information).
- For file download endpoints, set `Content-Disposition: attachment` to prevent browsers from rendering uploaded files inline.
- Strip or sanitize any user-generated content in responses to prevent reflected XSS, even on API-only servers (clients may render the response unsafely).

## 19. Infrastructure and Deployment

- Do not run the Node.js process as root. Use a non-root user in your container or on the host.
- Use a minimal base image for containers (e.g., `node:22-slim` or distroless). Remove build tools and unnecessary packages from the production image.
- Run a health check endpoint (`/healthz` or `/health`) that does not require authentication, for use by load balancers and orchestrators. Do not expose internal state or dependency details in its response.
- Set `NODE_ENV=production` to enable Express production optimizations and disable verbose error output.
- Use a process manager (`pm2`, or container orchestration like Kubernetes) that restarts the process on crash and distributes load across multiple instances.
- Implement graceful shutdown: on `SIGTERM`, stop accepting new connections, finish in-flight requests (with a timeout), close database connections, then exit.
