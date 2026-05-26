# Security Policy

## Reporting a Vulnerability

If you discover a security issue with this example app, please report it
privately using GitHub's **[Report a vulnerability](https://github.com/highnote-oss/highnote-consumer-prepaid-node/security/advisories/new)**
form (also reachable via the **Security** tab → **Report a vulnerability**).

Please do **not** disclose the issue publicly until we have had a chance to
investigate and respond.

For security issues with the `@highnote-oss/nodejs-sdk` package itself,
please report them on **that repo's** security tab, not here:

- [`highnote-oss/nodejs-sdk`](https://github.com/highnote-oss/nodejs-sdk/security/advisories/new)

We will acknowledge receipt within 3 business days.

## Status: reference demo, not production-hardened

This repository is an **example / reference application** showing how to build
on the Highnote API. It is intentionally not hardened for serving real users.
The section below enumerates the deliberate gaps so anyone copying the app
knows what they must add themselves before adopting it for anything beyond a
demo.

### A note on the word "production"

A few places in this codebase (`NODE_ENV === "production"`, the `JWT_SECRET`
required-in-production check, the production-only static-file serving block,
etc.) use the word "production" to mean **the deployed-demo mode** — the
Render single-container build that serves the SPA from the API and registers a
public webhook URL — as distinct from local dev. It is **not** a claim that
the deployed demo is fit for processing real customer money. Read every
`production` branch in this code as "any hosted instance of the demo."

### Deliberate gaps

These are intentional shortcuts appropriate for a demo. Each item names the
concern and the change you would make if you adopted the app for real users.

- **Session token in `localStorage`.** The frontend stores the JWT in
  `localStorage`, which is reachable from any same-origin script. A real
  deployment should issue the session as an `HttpOnly; Secure; SameSite`
  cookie set by the server, and switch the API auth middleware to read it
  from the cookie instead of an `Authorization` header. Migration is a real
  refactor and intentionally not done here.
- **No password complexity.** Signup only enforces `min(8)` — no entropy or
  composition rules. Production should add a real policy and ideally check
  passwords against a breached-password corpus.
- **Webhook events are not tenant-scoped.** `GET /api/webhooks/events` and
  the replay endpoint serve events from one shared `webhook_events` table to
  any authenticated caller; this is fine for a single-operator demo but a
  multi-tenant deployment must filter events to the calling user's account
  holder.
- **Stateless JWTs, no server-side revocation.** Tokens have a 1-hour expiry
  and logout only clears client-side storage. A real app should use
  short-lived access tokens + refresh tokens with a server-side revocation
  list, or opaque session IDs backed by a store.
- **60-second ownership cache.** `getUserResourceIds()` caches the set of a
  user's owned financial / external / card IDs for 60 seconds. If you revoke
  a card or unlink a bank account, the user can still operate on it for up
  to a minute. Production should shorten the TTL or invalidate the cache on
  every resource-state change.
- **Swagger UI exposed at `/docs`.** Intentional — discoverable API docs are
  a demo feature. Do not expose this on a real customer-facing deployment.
- **No Content-Security-Policy.** `@fastify/helmet` is registered for the
  other security headers (HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, etc.) but with `contentSecurityPolicy: false` — a strict
  CSP breaks the embedded Highnote SDK iframes (card viewer, secure inputs,
  document upload) and the Leaflet basemap tiles. A real deployment should
  write a tuned CSP that allow-lists those origins.
