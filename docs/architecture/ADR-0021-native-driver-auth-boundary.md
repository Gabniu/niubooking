---
id: ADR-0021
title: Native Driver Authentication Boundary
status: accepted
date: 2026-08-21
requirements: [REQ-LIVE-001, REQ-AUTH-001]
tests: [TEST-LIVE-001]
risks: [RISK-AUTH-SESSION-001, RISK-LOCATION-PRIVACY-001]
---

# Decision

NIU Driver uses NOVA OIDC Authorization Code + PKCE as a public native client.
The native app receives an access token, keeps it in platform secure storage,
and sends it as a bearer token to Booking. Booking verifies issuer, signature,
audience, expiry, and the exact local subject mapping before resolving tenant,
branch, role, and assigned-trip scope.

The platform-neutral `@bookingapp/driver-tracking` package owns only the safe
session lifecycle contract: restore, replace, expire, and sign out. It never
chooses a secure-storage vendor, logs token values, returns tokens from a
snapshot, or treats a device credential as a human identity. React Native will
provide the storage adapter and browser redirect adapter when the NIU Driver
app is built.

The same native application boundary persists only the non-secret active
tracking-session record (tenant, trip, opaque session reference, and expiry) so
an app restart can resume or stop its own server session. The record is never
returned in the UI snapshot and is cleared when the server session ends.

Access-token refresh is intentionally an app/provider integration concern. A
refresh token may be stored only by the same secure adapter after NOVA confirms
that the registered mobile client is allowed to receive one; it is not added to
the shared tracking core or sent to telemetry endpoints.

# Invariants

1. Browser users continue to use opaque Secure, HttpOnly cookies.
2. Native bearer authentication is optional at the API boundary and fails
   closed when verification or local admission is unavailable.
3. A stored credential must have a non-empty token and a future ISO expiry.
4. Expired or malformed persisted credentials are cleared before the app can
   publish telemetry.
5. Session snapshots expose only signed-in state and expiry, never token text.
6. Telemetry and assigned-trip commands use the current access token; they do
   not accept tenant, driver, vehicle, or session identity from the payload.

# Consequences

The future mobile shell can be tested on desktop with an in-memory adapter and
can use SecureStore/Keychain/Keystore without changing domain code. Physical
device work remains necessary to prove redirect handling, token refresh,
Android background notification, iOS restoration, permission loss, and reboot.
Until those tests pass, the native app is not production-ready.
