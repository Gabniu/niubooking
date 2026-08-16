# Batch Charter Template

## Identity

- Batch ID and name:
- Owner:
- Intended user/business outcome:
- Capability IDs:
- Explicitly out of scope:

## Contract boundary

- Domain invariants:
- API/events:
- Persistence and migration:
- Authorization, tenant, consent, and idempotency rules:
- User and operational surfaces:

## Work packets

Group work by independently reviewable seams: kernel, persistence, API, staff journey, public journey, integration, and evidence. A packet may be developed separately, but the batch closes only as a coherent vertical outcome.

## Proof plan

- Unit and property tests:
- Real PostgreSQL/concurrency tests:
- API/consumer contract tests:
- Browser journeys and responsive/accessibility states:
- Operational/retry/degraded tests:
- Golden industry fixtures affected:

## Exit evidence

- [ ] Capability ledger and feature surface matrix agree.
- [ ] No backend-only or frontend-only gap is unclassified.
- [ ] Additive migration and rollback/recovery approach reviewed.
- [ ] `npm run verify:batch` passes.
- [ ] `npm run verify:release` passes when release-bound.
- [ ] Graphify relationships refreshed and queried.
- [ ] Obsidian export refreshed.
- [ ] Residual risks and next-batch handoff recorded.
