---
id: ADR-0018
title: Trip-Scoped Realtime Fleet Tracking
status: accepted
date: 2026-08-19
requirements: [REQ-LIVE-001, REQ-LIVE-002, REQ-LIVE-003]
tests: [TEST-LIVE-001, TEST-LIVE-002, TEST-LIVE-003]
risks: [RISK-LOCATION-PRIVACY-001, RISK-REALTIME-COST-001, RISK-GPS-DEGRADATION-001]
---

# Decision

NIU Booking owns transport trip identity, local authorization, customer
visibility, current live state, retention, ETA presentation, and durable trip
events. Raw telemetry never becomes reservation truth and cannot change seats,
capacity, fares, boarding, or reservation lifecycle.

The branded NIU Driver mobile app uses the Traccar Client SDK for background
collection, stop detection, offline buffering, and retry. Phone-only tracking
uploads to an NIU-owned OsmAnd-compatible HTTPS endpoint. A private restricted
Traccar forwarder is an optional adapter for premium fleets with dedicated GPS
hardware; Traccar is not the tenant, trip, authorization, or customer-facing
system of record.

The shared driver-tracking core exposes a durable telemetry-queue adapter. The
native app supplies encrypted local persistence, and queue mutations are
serialized so a restart or concurrent location callback cannot silently drop a
position. Corrupt persisted records fail closed; the queue never becomes a
second source of truth for trip or reservation state.

Native staff authentication uses NOVA OIDC authorization code + PKCE through a
registered public mobile client. Booking accepts a verified bearer access token
only when its issuer, signature, audience, and exact local subject mapping all
match; browser sessions remain opaque Secure cookies. Device enrollment and
session publishing credentials are separate from identity: an authorized
session start issues a high-entropy, session-scoped Traccar credential, stores
only its hash, and invalidates it when the session ends or expires. It is held
in native secure storage and is never used as an identity token.

The first deployment uses PostgreSQL/PostGIS for current position, partitioned
history, route geometry, and spatial checks. Driver uploads use HTTPS. Staff and
customer maps consume a privacy-safe unidirectional realtime stream. MapLibre
is an optional browser enhancement behind a build-time approved style URL;
without a valid style the accessible route diagram remains the source of
truth and no tile requests are made. MapLibre renders maps from a replaceable
OSM-derived tile provider; regional PMTiles are the preferred bounded-cost
production path. Advanced road-network matching is behind a provider port,
with Valhalla the preferred self-hosted candidate.

# Authorization

Authorization resolves capabilities and data scope from current local state.
API routes never authorize by role label alone.

| Persona | Default live scope | Required capability |
|---|---|---|
| Organization owner | All active organization trips and branches | `fleet.location.view.organization` |
| Organization administrator | Explicit organization or selected-branch grant | `fleet.location.view.organization` or `fleet.location.view.branch` |
| Branch manager | Trips belonging to granted branches only | `fleet.location.view.branch` |
| Dispatcher / fleet controller | Granted branches, routes, depots, or assigned fleet | `fleet.location.dispatch` |
| Driver | Own currently assigned tracking session | `fleet.location.publish.assigned` |
| Conductor | Assigned trip status and vehicle position; no organization history | `fleet.location.view.assigned` |
| Customer / rider | One booked journey through an opaque, expiring capability | public trip capability |
| Public route viewer | Only an organization-enabled anonymized route projection | public route policy |
| NIU support | No standing access; separately elevated and audited | support elevation |

Role templates may grant these capabilities, but role names are not the
enforcement primitive. An empty branch list never means all branches. Transport
trips and tracking sessions carry explicit branch scope before manager/admin
views are enabled.

# Realtime contract

Every accepted position carries an event ID, enrolled device ID, monotonically
increasing sequence, capture and receive timestamps, latitude, longitude,
accuracy, speed, heading, battery state, provider, and app version. Tenant,
driver, vehicle, branch, and active trip are derived from the authenticated
session credential rather than trusted from the provider payload.

The current position advances only when `(capturedAt, sequence)` is newer.
Delayed offline points may be retained in history but never rewind the live
marker. Duplicate, impossible, future, excessively stale, inaccurate, or
rate-exceeding points are rejected or quarantined with reason evidence.

Freshness presentation is standardized:

- `live`: at most 15 seconds old;
- `delayed`: over 15 and at most 45 seconds;
- `signal_weak`: over 45 and at most 90 seconds;
- `offline`: over 90 seconds or an explicitly ended session.

The browser may interpolate between accepted points for smooth movement, but it
must stop extrapolating when freshness expires and disclose the last update.
ETA is a range with confidence and may be unavailable; the system never invents
false precision.

The first ETA estimator is deliberately local and conservative: it projects a
trusted position onto the published route geometry, advances only toward the
requested geocoded stop, bounds speed and dwell uncertainty, and returns no
estimate when route context is missing or stale. Traffic-aware matching and
historical dwell models remain provider seams rather than hidden guesses.

# Privacy and retention

- Driver tracking starts through an explicit assigned-trip action and stops at
  trip completion, revocation, or bounded grace expiry.
- Riders never receive driver contact details, raw device identity, pre-shift
  location, unrelated trips, or organization-wide history.
- Operational viewers receive only fields allowed by capability and scope.
- Raw position retention is policy-bound and short by default; current state and
  derived trip summaries have separate retention.
- Public links are opaque, rate-limited, revocable, single-purpose, and exchanged
  for a short-lived viewer session before streaming.
- Exact history access, export, retention changes, and support elevation are
  audited sensitive operations.

# Deployment and cost boundary

Begin with one separately deployable realtime process and PostgreSQL/PostGIS.
Do not add Redis, NATS, Kafka, or another database until measured concurrency or
horizontal scaling requires it. Add a broker only when more than one realtime
instance must share live topics or replay. Do not use public OpenStreetMap tile
servers as the production CDN and do not reverse-geocode every position.

Full Traccar is deployed only for accepted hardware/protocol requirements. In
that mode it is private, protocol-limited, forwards normalized positions to NIU,
and cannot be reached directly by riders or normal staff browsers.

# Acceptance

- Owner, administrator, manager, dispatcher, driver, conductor, rider, public,
  and support access tests prove both allowed and denied scopes.
- Cross-tenant, wrong-branch, unassigned-trip, expired-capability, and revoked-
  membership reads fail without record-existence disclosure.
- Offline replay, duplicates, out-of-order delivery, clock skew, server restart,
  reconnect, permission loss, and GPS degradation converge safely.
- Load simulation records ingest latency, fan-out latency, database growth,
  connection count, and cost per active vehicle/viewer at accepted targets.
- Staff and customer maps expose explicit loading, empty, permission-denied,
  delayed, weak-signal, offline, retry, and recovered states.
- Durable arrival/departure events are idempotent; raw points remain outside the
  reservation and platform-event models.

# Consequences

Phone-first tenants avoid the cost and duplicate domain model of a complete
tracking platform. Premium hardware fleets retain a proven Traccar protocol
path. GTFS Schedule and GTFS-Realtime follow ADR-0019 so public interoperability
uses stable public transit identity rather than private database identifiers.
Predictive ETA, traffic providers, and multi-instance messaging remain additive.
