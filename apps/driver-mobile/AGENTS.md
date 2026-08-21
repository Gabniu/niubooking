# NIU Driver app instructions

Read the repository root `AGENTS.md`, `PROJECT_CONTEXT.md`, and the relevant
realtime tracking batch before changing this app. This app is an Expo SDK 57
React Native surface over the shared Booking contracts; it must not duplicate
tenant, trip, reservation, or authorization rules.

Use the exact versioned Expo SDK 57 documentation before adding native modules.
Keep OIDC, secure storage, background location, and Traccar integration behind
explicit adapters. Never fabricate a trip or claim that location is sharing.

Run `npm run verify:mobile` after changes. Native background behavior requires
a development build and physical-device evidence; a web export only verifies
the universal shell and static rendering.
