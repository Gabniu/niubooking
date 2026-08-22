# NIU Driver

The native driver and conductor companion for assigned transport trips. This app shares the booking backend and `@bookingapp/driver-tracking` orchestration contract with the staff web experience.

## Current boundary

The first screen is a real, compact operational shell. It shows **Sign-in setup pending** when the public build configuration is absent, and otherwise opens the native OIDC redirect through the secure credential adapter. It does not invent trips or claim that location is active.

The app now registers a top-level Expo background-location task and exposes an explicit permission/start/stop adapter. A cold-start task restores the current native credential and active server session, records only valid samples through the shared controller, and stops capture when the session is absent or blocked. It is not considered production-ready until a development build and physical Android/iOS devices verify permission prompts, task recovery, offline queueing, and stop-sharing behavior.

The native runtime consumes these Expo config values without bundling secrets: `apiBaseUrl`, the OsmAnd-compatible `telemetryEndpoint` (`/v1/fleet/telemetry/osmand`), `authIssuer`, `authClientId`, the exact `niudriver://` `authRedirectUri`, and the opt-in `authRefreshEnabled`. The dynamic Expo config reads them from `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_TELEMETRY_ENDPOINT`, `EXPO_PUBLIC_AUTH_ISSUER`, `EXPO_PUBLIC_AUTH_CLIENT_ID`, `EXPO_PUBLIC_AUTH_REDIRECT_URI`, and `EXPO_PUBLIC_AUTH_REFRESH_ENABLED=true`. The sign-in adapter discovers the provider, requires S256 PKCE, exchanges the one-time code, and stores the expiring access credential through the OS-backed adapter. Refresh is enabled only by explicit build configuration, requests `offline_access`, stores the refresh credential in a separate OS-backed key, rotates it when NOVA returns a replacement, and clears both credentials after `invalid_grant`.

The native Traccar Client SDK adapter is available behind `createNativeTraccarClient()`, with `createNativeTraccarCapture()` providing the session start/stop boundary. It validates an HTTPS endpoint and session provider credential before forwarding configuration, start/stop, one-shot position, status, and diagnostic-log calls to the SDK. The API issues a high-entropy `niu_traccar_v1` credential only when an authorized tracking session starts, persists only its hash, and rejects it after session end or expiry. That credential is passed as the SDK's OsmAnd `deviceId`; the OIDC access token is never used as telemetry authentication. The API accepts the SDK's query/form fields, derives the active NIU session server-side, assigns ordering, and reuses the existing telemetry persistence path. The app shell is not auto-started yet: assigned-device provisioning, native SDK secure-storage review, and physical Android/iOS proof remain before production provider selection. The Expo prebuild plugin adds the SDK's Kotlin compatibility flag and iOS motion/background metadata.

## Commands

```bash
npm run typecheck --workspace @bookingapp/driver-mobile
npm run lint --workspace @bookingapp/driver-mobile
npm run web --workspace @bookingapp/driver-mobile
```

Use an Expo development build for native location verification; Expo Go is not the acceptance environment for background tracking.
