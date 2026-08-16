# BATCH-001 — Universal Occurrence and Reservation Kernel

## Current state

The contract and persistence packets are complete: domain invariants, service catalog foundations, inheriting service variants, neutral resource/capability requirement slots, HTTP summaries, additive migrations `019_occurrences_reservations.sql`, `020_public_reservation_idempotency.sql`, `021_communication_occurrence_subjects.sql`, `022_audit_events.sql`, `023_service_definitions.sql`, and `024_service_variants_requirements.sql`, tenant RLS policies, atomic capacity admission/release, retry-safe public reservation identity, staff lifecycle controls with same-transaction audit evidence, a post-commit communication callback, and compact staff/QR/service/composition pages are implemented. Existing appointment APIs remain compatible.

`ServiceOccurrence` and `Reservation` have framework-independent domain types, validation, capacity semantics, HTTP summaries, additive PostgreSQL tables, tenant RLS policies, atomic capacity admission, retry-safe public creation, and focused tests. Existing appointment APIs remain unchanged and continue to pass their regression suite.

## Remaining work packets

1. Repeat the approved-server transactional proof in CI/release automation.
2. Provider delivery and richer post-reservation confirmation.
3. Richer acceptance workflows for the golden Dental, Hospital, Driving School,
   Fitness, Transport, and Charter fixtures (the manifests and schedulable
   requirement proofs are now present in the shared registry).

## Acceptance gates

- [x] Domain and HTTP contracts compile under strict TypeScript.
- [x] Capacity, tenant, lifecycle, and quantity invariants have focused tests.
- [x] Migration applies and reruns on an approved PostgreSQL test server.
- [x] Concurrent reservation proof prevents overselling and releases capacity exactly once.
- [x] Existing appointment, QR, resource, reminder, and feedback journeys remain green.
- [x] Staff and public surfaces are discoverable and parity-audited.
- [x] Graphify and Obsidian refreshed at batch closure.
