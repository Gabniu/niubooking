---
id: ADR-0019
title: GTFS Schedule and GTFS-Realtime as First-Class Transit Projections
status: accepted
date: 2026-08-19
requirements: [REQ-GTFS-001, REQ-GTFS-002, REQ-GTFS-003]
tests: [TEST-GTFS-001, TEST-GTFS-002, TEST-GTFS-003]
risks: [RISK-GTFS-ID-DRIFT-001, RISK-GTFS-STALE-001, RISK-GTFS-INVALID-001]
---

# Decision

NIU Booking supports GTFS Schedule and GTFS-Realtime as first-class,
versioned, organization-controlled public projections of the transport domain.
They are not the source of booking, trip, vehicle, driver, fare, or telemetry
truth, and they do not replace private staff and rider tracking contracts.

GTFS Schedule is designed and validated before GTFS-Realtime is published.
Every realtime trip, stop, route, and vehicle reference must resolve against the
active static feed. Internal database UUIDs and driver/device IDs are never
published directly. Each exportable entity receives a stable public GTFS ID
whose continuity survives normal edits and deployments.

# Capability horizon

The complete standards boundary is planned now and delivered in verified layers:

1. Core Schedule: agencies, stops, routes, trips, stop-times, calendars,
   exceptions, shapes, frequencies, feed metadata, and attributions.
2. Rider quality: route colors and headsigns, transfers, blocks, stop hierarchy,
   bikes/cars, accessibility, translations, pathways, and station levels.
3. Commercial operations: Fares v2 products, media, rider categories, areas,
   networks, timeframes, leg rules, transfer rules, and contactless support.
4. Flexible transport: location groups, GeoJSON zones, pickup/drop-off windows,
   deviated routes, and booking rules for demand-responsive service.
5. Realtime: VehiclePositions, TripUpdates, Alerts, occupancy, and service
   relationship changes. Experimental detour/TripModifications support stays
   behind a versioned adapter and feature flag until the standard stabilizes.

This roadmap does not mean publishing empty or invented data. Each organization
enables only validated features for which it owns trustworthy source data.

# Schedule model

The first publishable feed includes:

- `agency.txt`: rider-facing operator, URL, timezone, language, and contact;
- `stops.txt`: stable named/geocoded stops, public codes, hierarchy, and
  accessibility;
- `routes.txt`: rider-facing identity, names, route type, colors, and operator;
- `trips.txt`: route, service calendar, direction, headsign, block, and shape;
- `stop_times.txt`: ordered times, pickup/drop-off policy, and shape distance;
- `calendar.txt` and `calendar_dates.txt`: normal service and exceptions;
- `shapes.txt`: ordered geometry for fixed-route services;
- `frequencies.txt`: headway service where departures are not clock-exact;
- `feed_info.txt` and `attributions.txt`: version, validity, and stewardship.

GTFS service times are stored as service-day seconds, not wall-clock timestamps,
so service after midnight can use values above `24:00:00`. Agency timezone and
service date identify the actual occurrence. A frequency window is explicitly
exact or headway-based; NIU never fabricates clock-exact departures for informal
matatu service.

# Stable identity and publication

- Public IDs use an immutable mapping scoped to one organization feed.
- A display-name, time, location, or assignment edit does not rotate an ID.
- Merges, replacements, and retirements are explicit; retired IDs are not
  silently recycled for another entity.
- One organization owns one canonical namespace and may represent multiple
  authorized operators as agencies.
- A candidate feed is generated as an immutable version, independently
  validated, and atomically promoted. Failure leaves the last valid feed live.
- Public URLs are permanent and expose version, ETag, and last-modified metadata.
- Publishing is opt-in and unavailable until blocking errors are resolved.
- Preview, publish, withdraw, rollback, and validation evidence are audited.

# GTFS-Realtime model

The initial Protocol Buffer feeds are full-dataset snapshots for:

1. `VehiclePositions` from privacy-safe current vehicle state;
2. `TripUpdates` from observed progress, cancellations, and confidence-aware
   arrival/departure predictions;
3. `Alerts` from explicitly published service disruptions.

Each entity uses stable IDs from the active Schedule version. Public vehicle IDs
are pseudonymous operational IDs, not number plates unless the operator has a
deliberate public policy. No feed exposes a phone, credential, driver name,
passenger, reservation, internal tenant ID, or branch ID. Frequency-based trips
carry service date/start-time disambiguation and the correct schedule relationship.

Feeds refresh at least every 30 seconds or whenever represented data changes,
and omit vehicle/trip observations older than 90 seconds. The private staff and
rider streams remain faster and richer; the GTFS feed is coarser, cacheable,
anonymous, and independently rate limited.

The first delivered realtime slice is the public `vehicle-positions.pb`
projection. It requires a published Schedule, realtime opt-in, an unexpired
tracking session, a current position, and stable vehicle/trip/route mappings.
It uses a dependency-free Protocol Buffer encoder, short cache headers, and
drops stale or unresolved rows. Generated versions snapshot route/trip/stop
IDs in `gtfs_feed_version_entities`, so later source edits cannot silently
change what the promoted feed means. Staff publication status also reports the
latest active observation and classifies the feed as healthy, delayed, stale,
or disabled using bounded freshness thresholds. The worker has a bounded,
cadence-controlled refresh/readiness task that writes a short-lived,
tenant-safe VehiclePositions cache keyed to the active Schedule version. The
public route serves that cache with validators and falls back to the same
privacy-safe projection when the cache is missing or expired; the cache is
never a second source of booking or telemetry truth. TripUpdates, Alerts,
occupancy, and detours remain explicit follow-on work.

# Product and authorization boundary

GTFS publication is a separate organization capability from private realtime
access. Owners and explicitly authorized transit administrators configure and
publish feeds. Managers and dispatchers may preview validation and operational
status only within their explicit scope. Public consumers gain no reservation or
private-trip access.

The exporter is a read-only projection. It cannot mutate routes, trips, seats,
bookings, fares, telemetry, or authorization. The private booking tracker can
show seat-specific and customer-specific facts that are intentionally absent
from GTFS.

# Current schema gaps

The core Schedule and realtime foundations now persist agency profiles,
stable GTFS IDs, named/geocoded stops, service calendars, shapes, stop-times,
frequency windows, feed versions, immutable per-feed route/trip/stop reference
snapshots, publication policy, tracking sessions, current positions, and the
short-lived VehiclePositions cache. Rider-quality extensions, TripUpdates,
Alerts, occupancy, detours, and richer source settings remain explicit
BATCH-005 work;
array order and internal UUIDs are not an acceptable substitute.

# Acceptance

- A deterministic fixture produces a valid core Schedule ZIP and passes an
  independent validator without blocking errors.
- Stable IDs survive non-identity edits and consecutive exports.
- Fixed, after-midnight, exception, headway matatu, and demand-responsive
  fixtures export without invented precision.
- Every realtime reference resolves against the promoted Schedule version;
  unknown or stale entities are omitted with observable evidence.
- VehiclePositions, TripUpdates, Alerts, and future detours pass PII/internal-ID
  scans and protocol validation.
- A failed build never replaces the last valid feed; rollback is proven.
- Accessibility, translations, fares, flexible service, and experimental
  features each have isolated fixtures and feature-level validation.
- Publication, withdrawal, and version promotion are tenant-safe and audited.

# Consequences

The domain captures durable public-network data before live tracking hardens
around incompatible identity. NIU can support third-party trip planners, public
open-data obligations, multimodal discovery, modern fares, paratransit/on-demand
service, and future GTFS evolution without coupling public standards to private
booking authorization.
