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
| CAP-CUST-001 | Optional customer account and record claim | Customer experience | All | planned | Customer web/PWA, public account-claim flow | TEST-CUST-001 | BATCH-002 |
| CAP-CUST-002 | Authenticated customer bookings, history, preferences, and feedback | Customer experience | All | planned | `apps/customer-web` or responsive customer route group | TEST-CUST-002 | BATCH-002 |
| CAP-CUST-003 | Transport rider app with ticket and scoped live journey | Customer experience | Transport; Charter | planned | `apps/rider-mobile`, ticket/trip web fallback | TEST-CUST-003; TEST-LIVE-002 | BATCH-005 |
| CAP-TRN-001 | Route, stop, trip, and passenger journey | Transport | Transport | in progress | Domain, additive route/trip/reservation/ticket persistence, named/geocoded stops, bounded LineString route geometry, tenant-safe API search/publish/reservation/manifest, QR-scoped public trip discovery/reservation/cancellation with expiring manage capability, atomic capacity admission and release, locked seat assignment for seat-mode trips, immutable fare snapshots, privacy-safe opaque public ticket retrieval through typed Next `/ticket/[token]`, accessible route preview, typed Next `/trip/[code]` passenger flow, and admitted staff `/app/transport` route/trip controls; full interactive map and live tracker next | TEST-TRN-001 | BATCH-004 |
| CAP-TRN-002 | Seat/capacity reservation and boarding | Transport | Transport | in progress | Atomic trip/occurrence capacity admission and release, immutable tickets, tenant manifest, locked seat assignment with validation and conflict handling, idempotent staff boarding, checked-in reservation transition, and append-only audit evidence; offline conductor journey next | TEST-TRN-002 | BATCH-004 |
| CAP-TRN-003 | Charter whole-vehicle journey | Transport | Charter | planned | Quote, reservation, dispatch | TEST-TRN-003 | BATCH-004 |
| CAP-LIVE-001 | Driver location ingestion and trip matching | Live operations | Transport; Charter | in progress | Branch-scoped trip/device/assignment/session persistence, replay-safe current/history state, authenticated enrollment/start/stop/handover and credential-bound telemetry API, NIU Driver with Traccar Client SDK, optional private Traccar hardware forwarder | TEST-LIVE-001 | BATCH-005 |
| CAP-LIVE-002 | Customer live vehicle map and ETA | Live operations | Transport; Charter | in progress | Issued tickets exchange for short-lived hashed viewer sessions; route geometry and named/geocoded stops are exposed through the privacy-safe public ticket/trip projection with an accessible SVG fallback, optional style-URL-gated MapLibre map, reduced-motion-aware sample-to-sample smoothing, freshness/accuracy/confidence details, and conservative route ETA ranges when context is sufficient; provider route matching, shareable tracking, and physical-device proof remain | TEST-LIVE-002 | BATCH-005 |
| CAP-LIVE-003 | Owner, admin, manager, dispatcher, driver, and conductor live operations | Live operations | Transport; Charter | in progress | Capability- and scope-resolved current-fleet query with assignment filtering, tenant-scoped SSE change fan-out, privacy-safe `/app/transport` staff list with freshness, workspace-scoped route/signal/search filters, role-aware tracking-health and assigned-scope summary, aggregate all-vehicles SVG overview, compact per-vehicle route maps using optional MapLibre or accessible SVG fallback, conservative ETA range/confidence, polling fallback, and a manager/dispatcher stop-active-trip command with a privacy-safe result; driver mobile start/stop/handover and conductor controls remain | TEST-LIVE-003 | BATCH-005 |
| CAP-LIVE-004 | GPS hardware interoperability | Live integration | Transport; Charter | planned | Private protocol-limited Traccar forwarder and normalized NIU ingest | TEST-LIVE-004 | BATCH-005 |
| CAP-GTFS-001 | GTFS Schedule publication | Transit interoperability | Transport; Charter | in progress | Stable public IDs, transport-source Schedule export, deterministic core GTFS text serialization, independent file-level reference validation, deterministic ZIP artifact creation, immutable content-addressed filesystem writes, tenant-safe active-version lookup, cacheable public Schedule delivery, owner/admin Generate Feed controls, and audited publish, withdraw, rollback, and generation evidence; durable worker orchestration, richer source settings, and advanced extensions remain | TEST-GTFS-001 | BATCH-005 |
| CAP-GTFS-002 | GTFS-Realtime publication | Transit interoperability | Transport | in progress | Privacy-safe protobuf VehiclePositions from fresh expiring telemetry, requiring realtime opt-in and stable vehicle/trip/route mappings; bounded worker refresh/readiness probing is wired, while persistent feed caching, TripUpdates, Alerts, occupancy, and detours remain | TEST-GTFS-002 | BATCH-005 |
| CAP-GTFS-003 | Advanced rider interoperability | Transit interoperability | Transport | planned | Accessibility, translations, transfers, Fares v2, occupancy, and gated experimental adapters | TEST-GTFS-003 | BATCH-005 |
| CAP-VOICE-001 | Versioned Booking provider API for Voice | Integration | Premium | planned | Machine API and events | TEST-VOICE-001 | BATCH-006 |
| CAP-VOICE-002 | Unified entitlements and customer timeline | Integration | Premium | planned | Control plane, staff timeline | TEST-VOICE-002 | BATCH-006 |
| CAP-OPS-001 | Layered verification and traceability | Engineering | All | in progress | CI, scripts, evidence docs | TEST-OPS-001 | BATCH-000 |
| CAP-OPS-002 | Tenant-scoped mutation audit evidence | Engineering | All | in progress | Append-only audit persistence for reservation lifecycle changes | TEST-OPS-002 | BATCH-001 |
