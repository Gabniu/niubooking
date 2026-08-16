---
id: ADR-0002
title: Shared Identity and Local Tenant Authorization
status: accepted
date: 2026-08-12
requirements: [REQ-IAM-001, REQ-IAM-002]
tests: [TEST-IAM-001, TEST-IAM-002]
risks: [RISK-CROSS-TENANT-001]
---

# Decision

Booking uses the shared NIU Auth (technical NOVA) Better Auth provider through OAuth 2.1/OpenID Connect Authorization Code + PKCE. The planned issuer is `https://novaauth.niuautomations.com`. Booking presents its own branded sign-in page, but it does not replace the provider's credential, recovery, or MFA surfaces.

The identity provider proves identity. Booking maps the verified `(issuer, subject)` pair to a local user and performs current local admission for organization, branch, role, permission, and entitlement on every sensitive operation.

Booking does not authorize using email, an organization claim, an ID token alone, or an arbitrary request-body tenant identifier.

Browser and mobile clients contain no confidential client secret. Human sessions never reuse machine API keys. Product-to-product credentials are separately scoped, rotatable, revocable, tenant-bound, and audited.

# Acceptance

- Issuer, audience, signature/JWKS, algorithm, expiry, state, nonce, redirect, and PKCE checks pass.
- Valid identity without local membership is denied generically.
- Revoked membership takes effect on the next sensitive request.
- Cross-tenant reads and writes fail closed.
- Existing Voice login migration remains reversible until its acceptance suite passes.

# References

- NOVA ADR-0037 Shared Better Auth Identity Provider
- NOVA ADR-0038 NOVA OIDC Federation Boundary
