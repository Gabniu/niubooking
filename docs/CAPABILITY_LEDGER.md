# Capability Ledger

This is the durable scope index. Every accepted capability has a stable ID, implementation state, surfaces, proof, and target batch. A feature is not lost when it moves between batches; its ID remains here.

An **industry pack** is a versioned set of vocabulary, defaults, fields, policies, workflows, dashboard composition, and permissions applied to the shared platform kernel. It does not copy or fork booking, customer, resource, communication, or authorization code.

## Status rules

- `planned`: accepted, modeled, and not started.
- `in progress`: at least one required layer is incomplete.
- `verified`: acceptance evidence exists in the test catalog.
- `deferred`: deliberately outside the active horizon with a named target.

## Ledger

| ID | Capability | Layer | Packs | Status | Surfaces | Test references | Target batch |
|---|---|---|---|---|---|---|---|
| CAP-CORE-001 | Tenant-safe identity and membership | Core | All | in progress | Auth, API, staff shell | TEST-AUTH-001 | BATCH-001 |
| CAP-CORE-002 | Customer and booking-subject records | Core | All | in progress | API, Customers | TEST-CORE-002 | BATCH-001 |
| CAP-CORE-003 | Service definitions, variants, and requirement slots | Core | All | in progress | Tenant catalog and composition API, persistence, and staff pages | TEST-CORE-003 | BATCH-001 |
| CAP-CORE-004 | Resource inventory, capabilities, and allocations | Core | All | in progress | API, Resources, Schedule, service composition | TEST-CORE-004; TEST-SCH-010 | BATCH-001 |
| CAP-SCH-001 | Service occurrence model | Core scheduling | All | in progress | Domain contract; API and persistence next | TEST-SCH-001 | BATCH-001 |
| CAP-SCH-002 | Reservation, participant, and capacity model | Core scheduling | All | in progress | Domain/HTTP contract, tenant persistence, atomic capacity admission/release, staff reservation lifecycle controls, and public QR reservation page | TEST-SCH-002; TEST-SCH-006; TEST-SCH-008 | BATCH-001 |
| CAP-SCH-003 | Holds and conflict-safe confirmation | Core scheduling | All | in progress | Public booking, staff booking, typed requirement assignments | TEST-SCH-003; TEST-SCH-010 | BATCH-001 |
| CAP-SCH-004 | Reschedule, cancel, waitlist, and no-show | Core scheduling | All | in progress | Staff and guest manage | TEST-SCH-004 | BATCH-002 |
| CAP-SCH-005 | Explainable multi-resource candidate availability | Core scheduling | All | in progress | Requirement-aware API, service composition | TEST-SCH-010 | BATCH-003 |
| CAP-QR-001 | QR destinations and public booking | Acquisition | All | in progress | QR admin create/list/status controls, guest booking | TEST-QR-001 | BATCH-002 |
| CAP-QR-002 | Styled print studio and scan proof | Acquisition | All | in progress | QR Print Studio preview, diagnostics, print, and SVG download | TEST-QR-002 | BATCH-002 |
| CAP-COM-001 | Configurable reminders and change links | Communications | All | in progress | Settings, worker, guest manage, occurrence reservations, lifecycle invalidation | TEST-COM-001; TEST-SCH-007; TEST-SCH-009 | BATCH-002 |
| CAP-FBK-001 | General and post-service feedback campaigns | Feedback | All | in progress | Admin, worker, public survey | TEST-FBK-001 | BATCH-002 |
| CAP-FBK-002 | Compact, stepped, and conversational surveys | Feedback | All | in progress | Authoring, public survey | TEST-FBK-002 | BATCH-002 |
| CAP-PACK-001 | Pack manifest, validation, and runtime composition | Industry runtime | All | in progress | Registry, pack catalog API, organization selection, bounded overrides, audited materialization into services/variants/requirements | TEST-PACK-001 | BATCH-003 |
| CAP-PACK-002 | Dental and hospital operations | Industry pack | Dental; Hospital | in progress | Validated clinical manifests and schedulable requirements; deeper care workflows remain | TEST-PACK-002 | BATCH-003 |
| CAP-PACK-003 | Driving school operations | Industry pack | Driving school | in progress | Validated lesson manifest and schedulable requirements; student progress workflows remain | TEST-PACK-003 | BATCH-003 |
| CAP-PACK-004 | Fitness and class capacity | Industry pack | Fitness | in progress | Validated class manifest and capacity requirements; memberships and attendance remain | TEST-PACK-004 | BATCH-003 |
| CAP-PACK-005 | General service-business operations | Industry pack | Salon; Professional; Automotive | planned | Configured operations workspace | TEST-PACK-005 | BATCH-003 |
| CAP-TRN-001 | Route, stop, trip, and passenger journey | Transport | Transport | in progress | Domain, additive route/trip/reservation/ticket persistence, tenant-safe API search/publish/reservation/manifest, atomic capacity admission and release, immutable fare snapshots, and privacy-safe opaque public ticket retrieval; public reservation journey and cancellation next | TEST-TRN-001 | BATCH-004 |
| CAP-TRN-002 | Seat/capacity reservation and boarding | Transport | Transport | planned | Booking, ticket, conductor tools | TEST-TRN-002 | BATCH-004 |
| CAP-TRN-003 | Charter whole-vehicle journey | Transport | Charter | planned | Quote, reservation, dispatch | TEST-TRN-003 | BATCH-004 |
| CAP-LIVE-001 | Driver location ingestion and trip matching | Live operations | Transport; Charter | planned | Driver app, telemetry gateway | TEST-LIVE-001 | BATCH-005 |
| CAP-LIVE-002 | Customer live vehicle map and ETA | Live operations | Transport; Charter | planned | Public trip tracker | TEST-LIVE-002 | BATCH-005 |
| CAP-VOICE-001 | Versioned Booking provider API for Voice | Integration | Premium | planned | Machine API and events | TEST-VOICE-001 | BATCH-006 |
| CAP-VOICE-002 | Unified entitlements and customer timeline | Integration | Premium | planned | Control plane, staff timeline | TEST-VOICE-002 | BATCH-006 |
| CAP-OPS-001 | Layered verification and traceability | Engineering | All | in progress | CI, scripts, evidence docs | TEST-OPS-001 | BATCH-000 |
| CAP-OPS-002 | Tenant-scoped mutation audit evidence | Engineering | All | in progress | Append-only audit persistence for reservation lifecycle changes | TEST-OPS-002 | BATCH-001 |
