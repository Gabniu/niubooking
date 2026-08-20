# BATCH-005 — Realtime fleet experience

## Outcome

Deliver trustworthy live vehicle tracking from drivers' phones to riders,
owners, authorized administrators, branch managers, dispatchers, conductors,
and drivers. Every persona sees a deliberately bounded projection of the same
trip-scoped live state.

The experience must look smooth on a healthy connection, remain honest when
GPS or the network degrades, protect driver privacy, and operate at a measurable
cost. It extends BATCH-004 transport trips; it does not create another booking,
reservation, fleet, identity, or tenant model.

## Current progress

- [x] Research decision: Traccar Client SDK in NIU Driver; NIU-owned telemetry
  and customer/staff projections; optional private Traccar hardware forwarder.
- [x] Role and visibility matrix covering owner, administrator, manager,
  dispatcher, driver, conductor, rider, public route viewer, and support.
- [x] Realtime, freshness, privacy, deployment, map, and cost boundaries in
  ADR-0018.
- [x] Deterministic access, telemetry validation, ordering, and freshness domain
  policies with executable tests.
- [x] Additive tenant/branch/trip-scoped device, assignment, session,
  idempotent receipt, newer-wins current-position, and partitioned history
  persistence in migration `037_realtime_tracking_foundation.sql`, with forced
  RLS, active-session uniqueness, audited handover, unit proof, and a
  server-run PostgreSQL integration lane.
- [x] Authenticated driver enrollment/start/stop, explicit handover, and credential-bound telemetry ingestion API; API contract tests cover admission and malformed input.
- [x] Authorized owner/admin/manager/dispatcher current-fleet query and staff list. The tenant/branch/assignment-filtered query is surfaced in `/app/transport` with honest freshness, empty, denied, error, retry, and polling fallback states.
- [x] First streaming fan-out slice: accepted current telemetry emits a tenant-scoped change signal, authorized staff can subscribe through SSE, and the client refetches the authoritative scoped snapshot. Multi-instance messaging, map, and ETA remain.
- [x] First rider trip slice: an issued ticket exchanges for a short-lived hashed viewer session, then fetches a privacy-safe live projection and subscribes to SSE updates from the canonical ticket page.
- [x] Route foundation: versioned routes now accept bounded LineString geometry plus optional named/geocoded stops; public trips and opaque tickets expose only that safe route projection, and the browser renders an accessible SVG route preview without external tile cost.
- [x] Rider map presentation slice: MapLibre `5.x` is an optional, style-URL-gated enhancement; without `NEXT_PUBLIC_MAP_STYLE_URL` the ticket stays on the accessible SVG route diagram. Trusted samples can interpolate only between captures, reduced motion disables interpolation, and rider cards disclose freshness, accuracy, and provider-supplied ETA/confidence without inventing estimates.
- [x] Conservative ETA foundation: the shared domain estimator projects a trusted position onto a published LineString, advances only toward a geocoded destination stop, includes bounded dwell/uncertainty, and returns a range with confidence. Public tickets and staff fleet projections serialize it only when route context is sufficient; otherwise ETA remains unavailable.
- [x] Staff route context slice: scoped fleet projections now carry published geometry and named stops, and `/app/transport` renders compact per-vehicle maps through the optional MapLibre/SVG component with freshness-aware vehicle markers.
- [x] Aggregate staff overview: the filtered fleet view now includes one accessible SVG overview with grouped routes, approximate live markers, freshness colors, and a no-geometry state without requiring external map tiles.
- [x] Tracking-health slice: the staff view now summarizes live, delayed, weak, and offline signals and labels driver/conductor views as assigned-scope without exposing internal session identifiers.
- [x] Manager stop-trip slice: owner/admin/manager/dispatcher staff can end a branch-scoped active trip from the staff list; the API returns only trip status and end time, and the row action is wired through the typed client.
- [x] GTFS core serialization slice: a validated Schedule draft now produces byte-stable `agency`, `stops`, `routes`, `trips`, `stop_times`, calendar/exception, shape, and frequency files with service-day times above `24:00:00` preserved.
- [x] GTFS readiness slice: admitted transit staff can review publication state, candidate issue counts, feature readiness, and validation details through `/app/gtfs`; drivers remain denied and no public URL is advertised before a real artifact endpoint exists.
- [x] GTFS artifact foundation: an independent file-level validator checks required files, headers, duplicate IDs, and cross-file references; a dependency-free deterministic ZIP builder rejects unsafe names and invalid candidates before storage.
- [x] GTFS public delivery slice: the active published version is resolved through a transaction-local public RLS policy and served only from the configured immutable artifact store with ETag, Last-Modified, conditional 304 responses, and cache headers; absent storage fails closed.
- [x] GTFS lifecycle command slice: owner/admin publish, withdraw, and explicit historical rollback are audited, idempotent, role-gated, and reflected in `/app/gtfs`; the command API refuses to validate without recorded independent evidence and refuses incomplete artifacts.
- [x] GTFS artifact write slice: the configured filesystem store now creates immutable same-byte-replayable ZIP objects atomically through a temporary hard-link promotion, while the publisher boundary validates files and returns the content digest/size needed for database attachment.
- [x] GTFS source/export slice: published transport routes, patterns, stops, calendars, exceptions, shapes, frequencies, and reserved public IDs now compose the Schedule draft; owner/admin `/app/gtfs` Generate Feed persists the artifact, records validation evidence, and audits the generation before publish.
- [ ] NIU Driver React Native application with physical-device background tests.
- [ ] Regional tile/PMTiles cost proof, route matching, provider-backed ETA calculation,
  and the physical rider browser journey remain.
- [ ] Validated GTFS Schedule publication. Stable ID, service-day time,
  fixed/headway contracts, atomic publication persistence, and audited lifecycle
  commands are built; durable worker orchestration, richer source settings,
  independent validator integration, flexible service, fares, accessibility, and rider-quality
  extensions remain.
  exporter, independent validator, flexible service, fares, accessibility, and
  rider-quality extensions remain.
- [ ] GTFS-Realtime VehiclePositions, TripUpdates, Alerts, occupancy, and gated
  experimental detours against the active Schedule version.
- [ ] Optional private Traccar hardware forwarder.
- [ ] Replay/load/cost simulation and production observability.

## Capability IDs and proof

| Capability | Required proof |
|---|---|
| `CAP-LIVE-001` Driver telemetry and trip matching | `TEST-LIVE-001` proves enrolled-device authentication, credential-bound ingestion, validation, ordering, offline replay, and correct active trip; rate/load and phone suites remain |
| `CAP-LIVE-002` Rider live map and ETA | `TEST-LIVE-002` proves journey-only authorization, smooth movement, uncertainty, stale/offline disclosure, and revocation |
| `CAP-LIVE-003` Staff realtime fleet operations | `TEST-LIVE-003` proves organization/branch/assignment scope for owner, admin, manager, dispatcher, conductor, driver, and audited support denial/elevation |
| `CAP-LIVE-004` GPS hardware interoperability | `TEST-LIVE-004` proves normalized Traccar forwarding without bypassing NIU authorization |
| `CAP-GTFS-001` GTFS Schedule publication | `TEST-GTFS-001` proves stable IDs, independently valid immutable feeds, fixed/headway/flexible services, and atomic promotion |
| `CAP-GTFS-002` GTFS-Realtime publication | `TEST-GTFS-002` proves fresh privacy-safe VehiclePositions, TripUpdates, and Alerts whose references resolve against the active Schedule feed |
| `CAP-GTFS-003` Advanced rider interoperability | `TEST-GTFS-003` proves accessibility, translations, transfers, Fares v2, occupancy, and gated experimental features independently |

## Source-of-truth boundary

```text
BATCH-004 Trip/Run + Vehicle Assignment
                  |
                  v
        Tracking Session (time bounded)
                  |
Driver Device -> Telemetry Gateway -> Current Position -> Staff/Rider projections
                  |                       |
                  +-> Position History    +-> ETA/freshness
                  |
                  +-> meaningful, idempotent trip events only
```

Booking remains authoritative for the trip, vehicle resource, reservation,
ticket, branch, assigned people, and entitlement. The telemetry path owns only
device enrollment, tracking-session state, raw/accepted positions, derived live
state, and location-delivery evidence.

## Authorization and view matrix

| View | Data scope | Must not expose |
|---|---|---|
| Owner live operations | All permitted active organization vehicles; branch and route filters | Device credentials; unnecessary driver PII |
| Admin live operations | Explicit organization or selected-branch grant | Implicit all-branch access from role name |
| Manager live operations | Membership branch IDs intersect trip branch | Other branches or organization-wide history |
| Dispatcher console | Assigned branches/routes/fleet with operational incidents | Unassigned fleets and unrelated customer details |
| Driver trip view | Own active assignment and tracking health | Other drivers or fleet history |
| Conductor trip view | Assigned trip position, boarding progress, and incident state | Other trips or exact historical traces |
| Rider tracker | Booked trip, route, stops, vehicle projection, freshness, ETA range | Driver phone/contact, raw device ID, pre/post-trip movement |
| Optional public route | Anonymized operator-enabled active route vehicles | Reservations, passenger identity, driver identity |
| NIU support | None without time-bound audited elevation | Standing fleet access |

Role templates grant capabilities; enforcement uses resolved capabilities plus
organization, branch, route, trip, and assignment scope. Because current trips
do not persist branch scope, adding explicit trip branch identity is a blocking
prerequisite for manager/admin streaming.

## Invariants

1. The device credential determines the enrolled device; the server determines
   tenant, branch, driver, vehicle, and active trip.
2. Only one publishing session is authoritative for a vehicle/trip at a time;
   handover is explicit, atomic, short-lived, and audited.
3. Current state advances by capture time and sequence, not arrival order.
4. Historical replay never rewinds a live marker or repeats durable trip events.
5. Telemetry cannot mutate reservation, seat, fare, ticket, or boarding truth.
6. Every staff read intersects tenant membership, live-location capability, and
   data scope; an empty branch list never means all branches.
7. Rider/public projections use opaque capabilities and reveal less than staff
   projections.
8. Tracking stops automatically after trip completion plus bounded grace.
9. The map freezes and discloses stale/offline state instead of simulating data.
10. Sampling, fan-out, retention, map tiles, matching, and ETA providers are
    measurable and budget limited.

## Coherent work packets

### Packet A — Secure telemetry foundation

Add branch-scoped trip identity, role-to-capability resolution, device
enrollment, tracking sessions, position validation, ordering/freshness policy,
current/history persistence, authenticated HTTPS ingestion, and a deterministic
simulator. Prove cross-tenant and wrong-trip rejection before rendering maps.

### Packet B — Staff live operations

Add current-fleet query and stream projections for owners, explicit-scope
admins, branch managers, dispatchers, assigned drivers, and conductors. Extend
`/app/transport` with fleet map/list modes, filters, tracking health, last update,
conservative ETA ranges, incident states, permission denial, empty fleet, and
degraded stream recovery. The list, route context, per-vehicle maps, ETA, and
route/signal/search filters, aggregate overview, tracking-health summary, and the
manager/dispatcher stop-active-trip action are now wired; driver mobile
session start/stop/handover and richer conductor controls remain.

### Packet C — Rider journey tracking

Exchange a ticket/manage capability for a short-lived viewer session. Add a
public MapLibre trip tracker with route/stops, smooth vehicle movement,
confidence, last update, delayed/offline disclosure, ETA range, and accessible
list fallback. The first browser slice is now wired with an optional style URL
and SVG fallback; provider-backed matching, ETA calculation, and journey
evidence remain. Customer tracking begins and ends according to trip policy.

### Packet D — Driver mobile reliability

Build NIU Driver in React Native with the Traccar Client SDK, secure credential
storage, assigned-trip start/stop, persistent Android notification, iOS
background restoration, offline queue, diagnostics, battery/network health,
incident actions, and a physical-device field matrix.

### Packet E — Maps, prediction, hardware, and scale

Add regional PMTiles, route geometry, confidence-aware route projection,
historical segment/dwell ETA ranges, optional Valhalla matching, a restricted
Traccar hardware forwarder, retention jobs, observability, and multi-instance
messaging only when load evidence requires it.

### Packet F — GTFS Schedule and Realtime publication

Add stable public IDs, operator profiles, named/geocoded stops, calendars and
exceptions, route/trip metadata, stop-times, shapes, and frequency windows. The
domain now serializes the core Schedule text files deterministically, including
after-midnight and headway service. Generate immutable Schedule candidates,
validate independently, and atomically promote only valid versions. Then publish
cacheable protobuf VehiclePositions, TripUpdates, and Alerts whose references
resolve against the active static feed.

Plan and isolate extensions for transfers, blocks, accessibility, translations,
pathways, Fares v2, demand-responsive booking rules/zones, occupancy, and
experimental detours. Each extension activates only when its source data and
validation fixtures are complete; NIU never emits guessed or empty claims.

## Verification matrix

- Domain: coordinate, accuracy, speed, timestamp, sequence, freshness, scope,
  and handover boundaries.
- Persistence: RLS, cross-tenant foreign relationships, newer-wins current
  state, duplicate idempotency, partition lifecycle, and retention.
- API: enrolled-device auth, revoked session, wrong trip, rate limit, malformed
  packet, owner/admin/manager/dispatcher scope, rider capability, and no leaks.
- Simulation: duplicates, reordering, long offline replay, jitter, detour,
  impossible jump, clock skew, reconnect, and server restart.
- Load: active vehicles, viewers per trip, ingest p50/p95/p99, fan-out latency,
  database growth, tile traffic, and cost per vehicle-hour/viewer-hour.
- Mobile: common Android manufacturers, iOS, reboot, force-stop, battery saver,
  permission changes, poor network, no network, low battery, and app update.
- Browser: desktop/mobile staff maps and rider tracker; keyboard, zoom, reduced
  motion, accessible status text, map unavailable, stale, offline, and recovery.
- GTFS: independent Schedule/Realtime validators, referential integrity, stable
  IDs, immutable promotion and rollback, public caching, stale omission, PII
  scans, and fixtures for fixed, headway, after-midnight, fare, accessible, and
  demand-responsive services.

## Initial service levels to validate

- Healthy-network server receive to viewer update: p95 at most 3 seconds.
- Healthy moving-device capture to server receive: p95 at most 8 seconds.
- `live` at most 15 seconds; `delayed` at most 45; `signal_weak` at most 90;
  then `offline`.
- GTFS-Realtime feed refresh: at least every 30 seconds when enabled, with no
  published vehicle position older than 90 seconds.
- No cross-tenant or wrong-branch location disclosure in any test or log.

These are acceptance targets to prove and tune, not promises copied into
marketing before physical-device and production-network evidence exists.

## Exit gate

BATCH-005 closes only when the authenticated phone-to-map lifecycle works for a
real assigned trip, staff scopes and rider capabilities fail closed, physical
phones recover from tested interruptions, the simulator meets accepted load and
cost targets, PostgreSQL retention is proven, maps expose degraded states, and
the capability ledger, surface matrix, Graphify, Obsidian, deployment runbook,
and CI evidence agree.
