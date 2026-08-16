---
id: ADR-0017
title: Branded Booking Login with NIU Auth Federation
status: accepted
date: 2026-08-16
requirements: [REQ-IAM-001, REQ-IAM-002]
tests: [TEST-IAM-001, TEST-IAM-002]
risks: [RISK-CROSS-TENANT-001]
---

# Decision

Booking owns a branded `/auth/sign-in` page and same-origin handoff routes so
the product feels like a complete application. NIU Auth remains the identity
authority: it owns email/password credentials, recovery, MFA, consent, and the
OIDC browser session. Booking never stores a second password database and never
auto-links an identity by email.

The user-facing flow is:

1. Booking shows its own compact sign-in page.
2. `Continue with NIU Auth` starts server-side Authorization Code + PKCE.
3. The callback relay forwards only `state`, `code`, or provider error to the
   Booking API.
4. Booking validates issuer, audience, JWKS, expiry, nonce, state, redirect URI,
   and PKCE, maps `(issuer, subject)` to a local user, checks membership, then
   issues its own opaque HttpOnly session cookie.

This deliberately borrows POS's branded consumer experience while retaining
Booking's safer server-side session model. A future local-login compatibility
path requires a separate reviewed identity decision; it must not be added as a
decorative form or a parallel password authority.
