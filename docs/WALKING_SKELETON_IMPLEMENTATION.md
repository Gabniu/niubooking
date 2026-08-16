# Walking Skeleton Implementation

## What exists

The first vertical slice now contains:

- framework-free local tenant admission policy;
- versioned tenant-context response contract;
- API composition seam that maps admission to the contract;
- frontend state adapter consuming the same response;
- responsive Obsidian/Emerald shell preview with real-data-safe empty and sign-in states;
- domain, API, and frontend parity tests;
- strict TypeScript project references and root verification scripts.
- Fastify HTTP route tests using the real injected request boundary;
- NOVA OIDC configuration and PKCE transaction seam with fail-closed validation.
- PostgreSQL tenant membership query contract, migration, and RLS policy;
- frontend HTTP client using the encoded Fastify route with session credentials.
- PostgreSQL pool adapter with transaction-local tenant context and rollback tests;
- JOSE verifier for issuer, audience, JWKS, expiry, and subject validation.
- opaque session tokens with hashed persistence values and secure cookie attributes;
- Fastify runtime composition from session cookie to local membership admission.

## Deliberate boundary

The NOVA OIDC client registration/token exchange, session persistence repository, and production deployment wiring are not falsely marked complete. They remain behind the interfaces established here. The preview intentionally says “Sign in to continue” and contains no invented tenant data.

## Verification evidence

Run from `bookingapp`:

```powershell
npm install
npm run verify
```

The feature-surface matrix must be updated in the same change as every backend or frontend capability.
