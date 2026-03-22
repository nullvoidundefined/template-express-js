# TODO

## Security

- [ ] Wire up Redis-backed rate limiter — set `RATE_LIMIT_STORAGE_URI` in production; the in-memory store does not work behind a load balancer (SECURITY.md §5)
- [ ] Add account lockout / progressive delays after repeated login failures, with notification to the account owner (SECURITY.md §5)
- [ ] Enforce HTTPS and HSTS at the reverse proxy level (Nginx/Cloudflare); set `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (SECURITY.md §3, §11)
- [ ] Restrict TLS to 1.2+ at the reverse proxy; disable TLS 1.0/1.1 and SSL (SECURITY.md §11)
