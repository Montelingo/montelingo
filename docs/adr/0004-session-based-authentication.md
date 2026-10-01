# ADR 0004: Session-Based Authentication

- Status: Accepted
- Date: 2026-10-01

## Context

Montelingo needs browser authentication that supports immediate sign-out, session revocation after password reset, and a frontend served through the same-origin web proxy.

## Decisions

- Use opaque, cryptographically random bearer tokens in a server-side session store rather than JWTs. Persist only a SHA-256 token hash; this allows sessions to be revoked and avoids exposing claims that remain valid until a JWT expires.
- Send the token only in the `montelingo_session` cookie, with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` enabled outside development according to settings. Set `Max-Age` from the session TTL. Never return or log the raw token.
- Protect cookie-authenticated state-changing requests with an Origin check. Accept `Origin`, or `Referer` when Origin is absent, only when it matches a configured allowed origin. Reject requests without either header outside tests. SameSite is defense in depth, not the CSRF control.
- Hash passwords with Argon2id. For an unknown sign-in email, verify against a precomputed dummy hash so unknown-account and wrong-password failures have comparable work and the same `401 invalid_credentials` response.
- Sign-up reports a duplicate address as `409 email_taken`. This intentionally favors a useful account-creation experience over preventing account enumeration at registration. Password-reset requests always return `204`, regardless of whether the address exists; delivery failures do not change that response.
- Reset links carry a cryptographically random, single-use token. Store only its SHA-256 hash; enforce an expiry; replace prior unused tokens when issuing another; reject missing, expired, or used tokens uniformly; and consume the token, change the password, and revoke all sessions atomically. A reset does not sign the user in.
- Sign-up does not create a session. The client signs in after successful account creation. This keeps account creation independent of session lifecycle and allows email verification to be introduced later without changing sign-up's session behavior.
- The in-memory rate limiter is single-process only. Multiple API replicas require a shared Redis or Postgres-backed limiter before scaling out.

## Consequences

Session revocation and password-reset invalidation are immediate database operations. Authentication requests require a database lookup, and deployments must configure allowed origins and secure cookies correctly. Rate limiting must move to shared storage before running multiple API processes.
