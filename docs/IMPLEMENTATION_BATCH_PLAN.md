# Implementation Batch Plan

We deliver coherent vertical outcomes, not isolated micro-slices. Each batch can contain parallel work packets, but it closes only when its backend, required frontend, authorization, migrations, degraded states, tests, traceability, and knowledge graph agree.

The capability ledger owns scope. This file owns execution order. Moving an item never deletes its capability ID or evidence obligation.

## BATCH-000 — Execution system — active

Install the traceability, source-size, lint, migration, real PostgreSQL, browser journey, CI, Graphify, and Obsidian gates described in `docs/batches/BATCH-000-execution-system.md`.

Exit: `npm run verify:batch` and release audit pass; CI runs the same gate; baseline tests remain green.

## BATCH-001 — Universal occurrence and reservation kernel

Finish identity/customer/service/resource foundations and introduce the abstraction needed by every industry:

`Service definition -> dated occurrence -> reservation -> participants/quantity -> resource allocations`

An appointment is a one-customer occurrence/reservation composition. A fitness class is a shared occurrence with many reservations. A transport trip is a route-backed occurrence with passenger reservations. A charter is a whole-capacity reservation. Do not encode these as unrelated booking engines.

Work packets: domain/state model, additive schema, concurrency/capacity rules, service/resource administration, staff calendar, public discovery, API contracts, and golden Dental/Hospital/Driving/Fitness/Transport/Charter fixtures.

Exit: real PostgreSQL proves exclusivity and capacity under concurrency; staff and guest journeys use the canonical model; no current appointment flow regresses.

## BATCH-002 — Complete customer lifecycle

Complete QR destination lifecycle and styled print exports, reminders and customer change links, general and post-service feedback, opt-out, delivery/provider composition, and staff-side booking changes. Add the optional authenticated customer account/PWA as a separate surface over the same public booking, manage, feedback, and communication contracts; guest booking remains fully usable without an account or app installation.

Exit: an organization can acquire, remind, change, serve, survey, and report on a customer using both guest and authenticated journeys; provider retries and stale work are observable and idempotent; account claim/linking is explicit and tenant-safe.

## BATCH-003 — Industry pack runtime and first acceptance packs

Implement a validated pack manifest for vocabulary, fields, workflow, navigation, dashboards, roles, policies, and defaults. Deliver Dental/Hospital, Driving School, Fitness, and configurable general-service fixtures without branching the core application.

Exit: the shared kernel suite passes for every pack; selecting a pack changes intended composition only; upgrades preserve tenant data.

## BATCH-004 — Transport reservation foundation

Charter: `docs/batches/BATCH-004-transport-reservation-foundation.md`.

Add stops, routes, dated trips/runs, boarding windows, manifests, seat or open-capacity inventory, fares, tickets, conductor actions, and charter whole-vehicle reservations. Keep dispatch and telemetry separate from reservation truth.

Exit: concurrent sale cannot oversell; boarding is auditable; route search and charter workflows pass mobile and offline/degraded journeys.

## BATCH-005 — Realtime fleet experience

Charter: `docs/batches/BATCH-005-realtime-fleet-experience.md`.

Build authenticated driver telemetry ingestion, trip matching, freshness/order
rules, current-position storage, fan-out, map matching, ETA uncertainty,
customer authorization, owner/admin/manager/dispatcher operational views,
stale-state disclosure, and replay/load simulation. Use the Traccar Client SDK
inside NIU Driver, keep NIU as the source of truth, and reserve a private Traccar
forwarder for fleets that need dedicated GPS hardware. Prefer a dedicated
realtime path while keeping only durable trip milestones in the platform event
model. Build GTFS Schedule as a versioned, independently validated public
projection with stable IDs before publishing GTFS-Realtime. Plan core feeds,
fixed/headway/flexible services, accessibility, transfers, translations, Fares
v2, occupancy, and isolated experimental extensions now; activate each only
when trustworthy source data and its validator suite are complete.

Add the transport rider app only after the public ticket/trip contracts prove
scoped live access, push/update policy, offline-safe ticket behavior, and honest
stale states; the web ticket/trip fallback remains mandatory.

Exit: real phones plus a simulator prove smooth staff/customer-visible movement,
role and branch isolation, reconnect correctness, bounded cost, privacy
retention, and safe degradation when GPS or connectivity fails. A fixed and
headway transport fixture also proves immutable Schedule promotion, stable IDs,
valid Realtime references, staleness limits, and zero PII leakage.

## BATCH-006 — Voice premium suite

Expose a versioned, idempotent Booking provider contract to Voice; connect shared NOVA identity, tenant mapping, entitlements, booking events, attribution, and the unified customer timeline. Standalone Booking and standalone Voice must still operate independently.

Exit: consumer-driven contracts and cross-product journeys prove valid AI phone booking, retries, downgrade isolation, and tenant safety.

## BATCH-007 — Scale, compliance, and launch hardening

Complete observability, audit/replay tools, backup/restore drills, accessibility and visual certification, security testing, performance budgets, data retention, regional/privacy controls, onboarding, billing, and support runbooks.

## Rules for every batch

1. Query Graphify before altering architecture and refresh it at closure.
2. Charter the outcome, capability IDs, invariants, boundaries, work packets, and proof before implementation.
3. Check backend/frontend parity continuously; classify integration-only and operations-only work explicitly.
4. Keep migrations additive and immutable; test the full chain against real PostgreSQL.
5. Enforce tenant, authorization, consent, idempotency, audit, and concurrency at durable boundaries.
6. Add success, empty, denied, stale, retry, offline, duplicate, and cross-tenant cases where applicable.
7. Keep every source file at or below 300 lines by splitting ownership early.
8. Run fast gates during work; run `npm run verify:batch` before closure and `verify:release` for release candidates.
9. Record residual risk and the next handoff instead of calling partial integration complete.
