# Quality and Verification Strategy

## Doctrine

Build to verify. A feature is complete only when its intended lifecycle works through the real boundary it claims to support.

CRUD is not lifecycle verification. Compilation is not browser verification. A pre-check is not a concurrency guarantee. A mocked provider test is not live-provider verification.

## Backend-to-frontend surface parity

Every backend capability is classified in `docs/FEATURE_SURFACE_MATRIX.md` as user-facing, integration-only, operations/internal, or intentionally deferred.

A user-facing capability is not complete when only its endpoint, command, job, or database behavior exists. Completion requires a discoverable authorized frontend surface and verification through the real API and persistence boundary. The surface must cover validation, loading, empty/unconfigured, permission-denied, server error, offline/degraded, pending, success, and responsive/accessibility behavior where applicable.

The parity audit is bidirectional:

- backend capability without required UI is recorded as a gap;
- frontend control without a working backend contract is recorded as a gap;
- fake or hard-coded production data is recorded as a gap;
- internal APIs and machine workflows require operational evidence, not invented customer UI;
- deferrals require an owner, reason, target phase, and acceptance reference.

## Required test layers

### Domain unit tests

- service requirement expansion;
- capability matching;
- availability intersections;
- buffer and travel calculations;
- assignment scoring;
- workflow transition rules;
- entitlement ledger arithmetic;
- pack resolution and override semantics.

Keep deterministic cores free of framework dependencies where practical.

### Persistence and concurrency tests

- competing confirmation requests on separate database connections;
- atomic multi-resource allocation;
- stable lock order and deadlock retry;
- capacity-one exclusion constraints;
- shared capacity under concurrent demand;
- hold expiry and commit conflicts;
- reschedule rollback;
- idempotent duplicate commands;
- credit consumption and compensating release.

### Tenant and authorization tests

- wrong organization and wrong branch;
- valid identity without membership;
- revoked membership/session;
- insufficient permission;
- support elevation audit;
- cross-tenant external reference;
- public token capability isolation;
- RLS/default-deny behavior where enabled.

### API and contract tests

- generated clients validate against canonical OpenAPI;
- Booking/Voice event schemas remain backward compatible;
- duplicate event delivery causes one business effect;
- out-of-order and delayed events converge correctly;
- receiver outage, retry, dead-letter, and replay;
- machine-credential scope and tenant binding;
- correlation and causation IDs span workflows.

### Frontend tests

- components and domain interactions;
- route-level loading/empty/error/offline/permission states;
- desktop, tablet, and mobile journeys;
- keyboard and focus order;
- screen-reader names and announcements;
- reduced motion and zoom;
- long and translated content;
- pack switching without stale terminology or navigation.

### Production build gates

- format/lint;
- strict typecheck;
- unit and integration suites;
- migration check;
- production build;
- dependency/security audit;
- focused end-to-end browser tests;
- backend-to-frontend surface parity audit;
- visual review at target breakpoints;
- Graphify health check and Obsidian export after durable changes.

## Foundational acceptance scenarios

1. Manual Driving lesson requires student, compatible instructor, compatible vehicle, credit, location, and time.
2. A nominally empty time is unavailable when any required allocation cannot be satisfied.
3. Two customers racing for the same instructor/vehicle combination cannot both confirm.
4. Failure to allocate one resource rolls back every allocation.
5. Expired Voice offer cannot create a booking; refreshed offers are returned.
6. Booking outage during a call creates a reviewable request/callback, never a fabricated booking.
7. Dental procedure can require practitioner, assistant, room/chair, form prerequisite, and cleanup buffer.
8. Salon service can remain simple without exposing unnecessary resource-engine configuration.
9. Cancelling or rescheduling preserves history and applies credit policy exactly once.
10. A booking-only tenant completes its entire workflow without Voice services configured.
11. A premium tenant links call, customer, booking, reminder, fulfillment, and outcome.
12. A valid user from another tenant sees no data and cannot infer whether a protected record exists.

## Evidence record

Each completed slice records:

- requirement/test identifiers;
- commands run and results;
- real or mocked boundaries used;
- browser/device dimensions checked;
- migrations applied and rollback behavior;
- known gaps stated plainly;
- artifacts or screenshots where visual layout matters.
- feature-surface matrix entries added or updated.
