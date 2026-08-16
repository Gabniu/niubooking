---
id: DB-001
title: Foundation Decisions Before the Walking Skeleton
status: accepted
date: 2026-08-12
requirements: [REQ-FOUNDATION-001]
tests: [TEST-FOUNDATION-001]
risks: [RISK-FOUNDATION-REVERSAL-001]
---

# Foundation Decision Brief

## Recommendation

Proceed with a TypeScript-first, PostgreSQL-backed modular monolith in a pnpm workspace. Use Next.js for the web experience, Fastify for the domain API, the `pg` driver with typed repository adapters plus explicit SQL migrations for persistence, and a separate worker process sharing application packages. Connect to NIU Auth through server-side Authorization Code + PKCE and an opaque Booking session cookie.

Use synchronous OpenAPI operations for Voice commands and a PostgreSQL transactional outbox delivering signed, versioned webhooks for durable events. Do not add Kafka, microservices, Redis, or a second booking database to the first release unless measured requirements justify them.

The original walking skeleton proved contracts with static HTML fixtures. The web
implementation is now migrating to the approved Next.js App Router + React
surface; the fixture server remains only as a temporary compatibility bridge for
routes not yet migrated.

This is a working architecture decision, not a promise that every library remains forever. Domain contracts, ports, SQL invariants, and tests are the durable assets.

## Decision summary

| Area | Working decision | Why now | Reversal boundary |
|---|---|---|---|
| Repository and runtime | pnpm workspace, Node 24 LTS, strict TypeScript | Aligns with current NOVA applications and local tooling | Package boundaries and OpenAPI isolate runtime changes |
| Web | Next.js with route groups for staff and customer flows | SSR/public pages, server integration, one initial deployment | Split customer portal when scale or ownership requires it |
| API | Fastify modular monolith | JSON Schema/OpenAPI, low overhead, explicit composition | Domain packages do not depend on Fastify |
| Persistence | PostgreSQL, `pg`, typed repositories, reviewed SQL migrations | Range/exclusion constraints and explicit tenant controls | Kysely remains a measured future option, not an unimplemented dependency |
| Tenancy | Shared schema, explicit `tenant_id`, composite tenant keys, RLS defense | Affordable operations with strong isolation | Large tenants can later move to dedicated databases |
| Auth | NOVA OIDC, server callback, PKCE, opaque HTTP-only Booking session | Keeps provider tokens and secrets out of browser storage | Narrow identity/session ports |
| Scheduling | UTC instants, IANA timezone, half-open intervals, atomic allocations | Correct DST and concurrency behavior | Policy modules isolate horizon/travel changes |
| Public identity | Guest-first verified contact with expiring manage capability; optional account claim | Lowest-friction affordable booking | Customers can later attach the same records to accounts |
| Payments | Provider-neutral intents/webhooks and an independent append-only credit ledger | Supports M-Pesa/card choices without polluting bookings | Payment adapters are replaceable |
| Voice integration | OpenAPI commands plus outbox-backed signed webhooks | Simple, durable, observable, replayable | Broker adapter can replace webhook delivery later |
| Industry customization | Code-reviewed versioned packs plus schema-limited tenant overrides | Prevents forks and arbitrary code execution | Pack registry and migrations are explicit |
| Commercial model | Capability entitlements; Booking Essentials, Booking Operations, Voice, Premium Suite | Preserves affordable entry and clean upgrades | Plans map to capabilities outside domain code |
| Deployment | Containers, managed PostgreSQL, object storage, stateless web/API/worker | Portable and operationally understandable | Cloud provider remains undecided |

## Why this stack

The existing Voice product proves that PostgreSQL constraints, explicit booking holds, React, and service adapters work for this domain. Its single-resource appointment shape should inform tests and migration, not become Booking's persistence model.

The NOVA repository already uses Node 24+, Next.js, TypeScript, PostgreSQL, and Better Auth. Booking keeps its existing `pg` repository boundary because it is already covered by tenant, concurrency, and migration tests; changing query libraries now would add migration risk without user-facing value.

Node 24 is an LTS line through April 2028. Pin the major line in the repository and update patch releases through automated, verified dependency maintenance.

## Detailed choices

### Repository

```text
apps/
  web/             Next.js staff and public route groups
  api/             Fastify HTTP composition root
  worker/          outbox, notifications, expiry and reconciliation
packages/
  auth/            consumer session and tenant admission contracts
  contracts/       versioned JSON Schema, OpenAPI and event envelopes
  database/        typed `pg` repositories, migrations and tenant transaction helpers
  design-system/   Booking tokens and accessible primitives
  domain/          framework-free value objects and policies
  industry-packs/  schema, registry and fixtures
  observability/   logs, traces, metrics and audit conventions
  scheduling/      slot generation, requirements and assignment
```

Keep one lockfile, strict project references, dependency boundaries, and root verification commands. Source files remain approximately 300 lines or fewer.

### Tenancy

Use one shared PostgreSQL schema initially. Every tenant-owned primary and foreign relationship includes `tenant_id`. Sensitive query execution occurs in a transaction that sets trusted tenant context using `SET LOCAL`; RLS is defense in depth, not the only application check.

Cross-product references use `(provider, external_tenant_id, external_type, external_id)` under a global `platform_org_id`. They are not foreign keys into Voice.

### OIDC and sessions

The API owns the callback and code exchange. Browser code receives no provider refresh token or confidential client secret. After validating issuer, audience, JWKS, expiry, state, nonce, redirect, and PKCE, Booking maps `(issuer, subject)`, performs local admission, and creates an opaque, revocable Booking session in a secure HTTP-only cookie.

### Scheduling and time

- Persist instants in UTC and preserve the IANA timezone used for interpretation.
- Use half-open `[start, end)` intervals.
- Default public horizon: 90 days; staff horizon: 365 days; configurable within a reviewed hard ceiling.
- Weekly availability plus dated exceptions is V1; recurring bookings are not.
- Travel is a `TravelTimePolicy`: fixed buffers first, zone matrix for the Driving Pack, external routing later.
- Holds expire server-side and confirmation revalidates every allocation transactionally.

### Payments and credits

Bookings reference provider-neutral payment intents. Package credits use an append-only internal ledger and never use payment-provider state as their balance. Deposits are optional by service policy. Webhooks are signed, idempotent, and reconciled. No insurance or clinical billing enters V1.

The first live payment adapter remains a business decision. If Kenya is the first launch market, prioritize M-Pesa and one card processor; do not embed either provider into the domain model.

### Public customer identity

Permit guest booking after contact verification appropriate to the configured channel. Issue a narrow, expiring manage-booking capability. An authenticated customer may later claim/link matching records through verified contact and explicit conflict handling. Email or phone similarity alone never silently merges customer records.

### Events and Voice

Voice calls Booking synchronously for customer lookup, availability, holds, confirmation, reschedule, and cancellation. Booking commits domain state and its outbox event atomically. The worker signs and delivers versioned webhook envelopes; Voice records inbox deduplication and supports replay. Unknown timeout outcomes are resolved by idempotency-key lookup.

### Plans and capabilities

Initial catalogue:

- **Booking Essentials** — affordable booking-only entry, core calendar, public booking, customer records, basic reminders, one active Industry Pack, and configurable usage limits.
- **Booking Operations** — multi-branch operations, packages, forms, fulfillment, outcomes, advanced automation and analytics.
- **Voice** — existing standalone communications capabilities.
- **Premium Suite** — Booking Operations plus Voice integration capabilities.

Industry Packs may be included or sold as add-ons. Application code asks for capability identifiers, never plan names or prices.

## Decisions intentionally left outside code

These do not block a local walking skeleton but must be accepted before production data or payment traffic:

1. First launch country and applicable privacy/regulatory review.
2. Production cloud, region, backup geography, recovery objectives, and monthly infrastructure budget.
3. First payment providers and merchant-account ownership.
4. Exact plan prices, quotas, overages, trials, taxes, and reseller rules.
5. Email/SMS/WhatsApp providers and consent/retention policy.

## Walking-skeleton acceptance

The first implementation may begin when ADR-0004 through ADR-0012 are accepted as working defaults. It must prove:

1. one root command installs, lints, typechecks, tests, and builds the workspace;
2. a browser begins OIDC Authorization Code + PKCE without containing a client secret;
3. the callback resolves `(issuer, subject)` and denies a user without local membership;
4. an admitted user receives a revocable Booking session and reaches one tenant-safe endpoint;
5. the responsive Obsidian/Emerald shell renders real session/context data or an honest state;
6. cross-tenant access fails in API and database integration tests;
7. desktop, tablet, mobile, keyboard, and reduced-motion checks are recorded;
8. no authored source file exceeds the repository line-count gate.
9. the feature-surface matrix proves that the tenant-context endpoint has a real shell surface and that auth/integration-only endpoints are classified rather than accidentally omitted.

## Sources

- Node.js release schedule: https://nodejs.org/en/about/previous-releases
- NOVA ADR-0036 Frontend Design Rules
- NOVA ADR-0037 Shared Better Auth Identity Provider
- NOVA ADR-0038 OIDC Federation Boundary
- Voice Phase S implementation and dependency manifests
