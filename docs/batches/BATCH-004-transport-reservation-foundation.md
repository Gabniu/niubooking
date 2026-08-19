# BATCH-004 — Transport reservation foundation

## Outcome

Add transport reservations on the shared occurrence kernel. A route-backed trip
is an occurrence, a passenger journey is a reservation, and a vehicle seat or
open-capacity unit is a resource allocation. Charter keeps the same kernel but
reserves the whole vehicle and crew for one journey interval.

This batch must support matatu/bus operators, scheduled shuttle services, and
charter operators without creating a second booking engine.

## Current progress

- [x] Domain route/trip contracts and invariant tests.
- [x] Additive migration `030_transport_foundation.sql` for tenant-scoped route
  versions, ordered stops, dated trips, boarding windows, and vehicle links.
- [x] Database adapter tests for ordered route reads, route writes, tenant-safe
  trip creation, occurrence-window validation, and trip-window reads.
- [x] Authorized API route/trip search and publish routes with tenant checks,
  safe validation, runtime database composition, and contract tests.
- [x] Tenant-authorized passenger reservation API with origin/destination stops,
  retry-safe creation, and atomic trip plus occurrence capacity admission.
- [x] Immutable fare-snapshot ticket issuance and tenant-authorized manifest
  retrieval with deterministic opaque ticket tokens.
- [x] Public opaque ticket retrieval with a privacy-safe journey projection;
  tenant, vehicle, and customer identity stay server-side.
- [x] Public QR trip discovery and passenger reservation creation with
  consent-aware contact capture, idempotent admission, and tenant rechecks.
- [x] Migration `033_transport_boardings.sql` and an idempotent, append-only
  staff boarding action that checks in the reservation and records audit data.
- [ ] Public passenger reservation journey, boarding, and typed
  staff/public pages.
- [ ] Seat assignment/open-capacity refinement, cancellation policy, and
  real PostgreSQL/browser journey proof.

## Capability IDs and proof

| Capability | Required proof |
|---|---|
| `CAP-TRN-001` Route, stop, trip, and passenger journey | `TEST-TRN-001` route search returns ordered stops, dated trips, boarding windows, and tenant-safe public summaries |
| `CAP-TRN-002` Seat/capacity reservation and boarding | `TEST-TRN-002` concurrent sales cannot oversell; ticket and boarding actions are idempotent and auditable |
| `CAP-TRN-003` Charter whole-vehicle journey | `TEST-TRN-003` a charter reserves vehicle and crew capacity for the complete interval |

## Boundaries

In scope: stops, routes, route versions, dated trips/runs, boarding windows,
seat/open-capacity inventory, fares, passenger reservations, tickets,
manifest views, conductor actions, and charter reservations.

Out of scope: GPS ingestion, current vehicle position, map matching, ETA
calculation, driver telemetry, and customer live maps. Those belong to
BATCH-005 and must consume durable trip identity without changing reservation
truth.

## Canonical model

```text
Route -> ordered RouteStops -> Trip/Run (dated occurrence)
                                      |
                                      +-> BoardingWindow
                                      +-> PassengerReservation -> Ticket
                                      +-> Seat/OpenCapacity allocation

CharterRequest -> CharterReservation -> whole vehicle + crew allocations
```

The existing occurrence and reservation identifiers remain the durable join
points. Public links expose opaque trip/ticket capabilities only; they never
expose tenant IDs, internal vehicle IDs, or customer identity.

## Invariants

1. Every route, trip, fare, vehicle, and reservation is tenant-scoped and
   checked inside the same authorization transaction.
2. Stop order is explicit and versioned; changing a route creates a new route
   version and never rewrites a published trip.
3. A passenger reservation can only be confirmed inside a trip's published
   boarding window and while capacity remains.
4. Seat assignment is optional for open-capacity operators but, when present,
   is unique per trip and protected by a database constraint.
5. Retries use idempotency keys for reservation, ticket issuance, and boarding;
   replay returns the original outcome without double-selling or double-
   boarding.
6. Cancellation releases capacity atomically and records an audit event.
7. Boarding is append-only evidence with actor, time, ticket, trip, and action;
   it cannot mutate a completed trip into an available one.
8. Charter reservations allocate the whole vehicle and required crew across
   the complete interval, using the same half-open overlap rules as bookings.
9. Fares are immutable snapshots on a ticket. Later fare edits do not change
   an issued ticket.
10. Offline/degraded operator views may queue an idempotent action, but the
    server remains the authority and conflict resolution is explicit.

## Work packets

1. Domain contracts and fixtures for bus, matatu open-capacity, seat-based
   shuttle, and charter journeys.
2. Additive migrations for route versions, stops, trips, boarding windows,
   fare snapshots, tickets, seat/open-capacity allocations, and boarding audit.
3. Tenant-authorized API routes for route search, trip publishing, reservation,
   ticket issuance and manifest, plus QR-scoped public trip discovery,
   passenger reservation, opaque ticket retrieval, and boarding; cancellation,
   and charter quote/
   reservation.
4. Typed staff pages for routes/trips, manifest, conductor boarding, and
   charter operations; reuse pack navigation rather than adding a separate
   transport shell.
5. Typed public pages for route search, trip selection, passenger reservation,
   ticket/manage link, and a clear unavailable/full/expired state.
6. Concurrency tests against real PostgreSQL plus browser journeys for mobile
   public reservation and degraded operator boarding.
7. Backend/frontend parity and capability-ledger updates before closure.

## Frontend states required

Every route must represent loading, no routes, no trips, full trip, expired
boarding window, reservation conflict, offline/degraded action, success, and
retry. Public copy must say what happened and what the passenger can do next.
Staff manifest and boarding controls must show pending, already boarded, and
conflict states without allowing duplicate actions.

## Exit gate

Do not mark BATCH-004 complete until the three transport tests pass against
real PostgreSQL, public and staff routes use the same contracts, tenant and
authorization checks are proven, Graphify is refreshed, source-size and parity
gates pass, and the CI browser/audit workflow is green. BATCH-005 may then add
telemetry by consuming trip IDs without changing these reservation invariants.
