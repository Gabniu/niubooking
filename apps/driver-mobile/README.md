# NIU Driver

The native driver and conductor companion for assigned transport trips. This app shares the booking backend and `@bookingapp/driver-tracking` orchestration contract with the staff web experience.

## Current boundary

The first screen is a real, compact operational shell. It intentionally shows **Sign-in setup pending** until the native OIDC redirect and secure credential adapter are installed. It does not invent trips or claim that location is active.

Background location is wired at the configuration boundary, but it is not considered production-ready until a development build and physical Android/iOS devices verify permission prompts, task recovery, offline queueing, and stop-sharing behavior.

## Commands

```bash
npm run typecheck --workspace @bookingapp/driver-mobile
npm run lint --workspace @bookingapp/driver-mobile
npm run web --workspace @bookingapp/driver-mobile
```

Use an Expo development build for native location verification; Expo Go is not the acceptance environment for background tracking.
