# Master Execution Plan

## 1. Outcome

Build a premium, multi-tenant Booking and Service Operations platform that succeeds in three commercial configurations:

1. **Booking** — a complete, affordable standalone product.
2. **Voice** — the existing independently purchasable communications product.
3. **Premium Operations Suite** — Booking and Voice linked through shared identity, entitlements, APIs, and events.

The platform starts with booking but grows across the full service lifecycle:

```text
Demand -> Qualification -> Feasible Slot -> Booking -> Payment/Package
       -> Preparation -> Check-in -> Delivery -> Outcome -> Follow-up -> Rebook
```

The visual direction follows the compact NOVA system: a white navigation rail and
workspace, aligned rail/body headers, restrained weights, Hanken Grotesk, and
Booking blue (`#140BA7`) for primary actions. Industry accents add context only
where they add meaning. The approved web target is Next.js App Router + React +
TypeScript; legacy HTML remains only as a time-boxed migration bridge.

## 2. Non-negotiable product principles

- Standalone Booking must never feel like a cut-down Voice add-on.
- Premium integration must feel native, not like two products embedded in iframes.
- Booking is the source of truth for service delivery and availability.
- Voice is the source of truth for communications and calls.
- A universal primitive belongs in Core; vertical vocabulary and composition belong in an Industry Pack.
- AI may interpret intent and rank valid choices. Deterministic services decide feasibility and enforce invariants.
- Every mutation is tenant-safe, authorized, idempotent where externally retried, and auditable.
- Every feature is built to verify across its real lifecycle.
- Realtime location is trip-scoped operational data: owners may see the
  organization, while admins, managers, dispatchers, drivers, conductors, and
  riders see only capability- and assignment-bounded projections.
- Source files should remain at approximately 300 lines or fewer by splitting responsibilities early.
- Accepted scope is recorded in `docs/CAPABILITY_LEDGER.md`; batch membership may change, but capability IDs and test obligations do not disappear.
- A batch closes only when `npm run verify:batch` passes and Graphify plus Obsidian evidence are refreshed.

## 3. Product and commercial architecture

| Capability | Booking | Voice | Premium Suite |
|---|---:|---:|---:|
| Staff scheduling and public booking | Yes | No | Yes |
| Customer and subject records | Yes | Call contacts only | Unified view |
| Services, resources, availability | Yes | No | Yes |
| Packages, forms, outcomes | Yes | No | Yes |
| Calls, queues, recordings, transcripts | No | Yes | Yes |
| AI phone booking | No | Voice-only lead capture | Real-time valid booking |
| Missed-call recovery | No | Callback list | Demand-to-booking workflow |
| Call-to-booking attribution | No | Partial | End-to-end |
| Unified customer timeline | No | Communications timeline | Full timeline |

Entitlements gate capabilities, not duplicated codebases. Organizations can upgrade or downgrade without migrating their canonical Booking data.

## 4. Universal domain kernel

### Core concepts

- Organization, branch, staff member, role, permission, entitlement
- Customer and booking subject
- Service definition, variant, duration, price, policy
- Resource and resource group
- Capability and qualification
- Availability rule, exception, closure, buffer, travel policy
- Booking, participant, requirement, allocation, hold, status transition
- Package, entitlement unit, ledger entry
- Form template, form response, consent
- Fulfillment session and outcome record
- Payment intent, invoice reference, refund reference
- Notification preference and delivery attempt
- Feedback campaign, survey template/version, response, reminder schedule, and delivery attempt
- Audit event and integration event
- QR destination, public booking code, attribution source, scan, and booking counters

`BookingSubject` separates the purchaser/contact from the person, animal, vehicle, asset, room, or case receiving the service.

The scheduling kernel is intentionally split into `ServiceOccurrence` (a dated service delivery with lifecycle and capacity) and `Reservation` (a tenant-scoped customer claim with quantity and status). The current appointment-shaped `Booking` remains a compatibility composition while BATCH-001 adds the durable occurrence/reservation boundary. This lets a dental visit, driving lesson, fitness class, transport trip, and charter journey share invariants without forcing their workflows or labels to be identical.

### Scheduling model

A service expands into one or more typed requirements. Each requirement declares:

- requirement kind;
- quantity or capacity;
- required capabilities;
- whether assignments are simultaneous or sequential;
- duration, setup, cleanup, and travel constraints;
- acceptable resource groups;
- whether assignment is customer-selected or system-assigned.

The scheduling pipeline is:

```text
Request
  -> resolve tenant, branch, pack, service, policies
  -> expand requirements
  -> generate candidate intervals
  -> intersect resource and staff availability
  -> apply buffers, travel, capacity, package, and policy constraints
  -> rank valid assignments
  -> create expiring hold
  -> atomically confirm all allocations
```

The database is the final concurrency authority. Multi-resource confirmation uses a stable lock order, transactional allocation, exclusion/capacity protection, deadlock retry, and idempotency.

### Workflow model

Core defines a configurable state-machine framework and stable semantic categories. Packs define allowed transitions and labels. Example core semantics include requested, held, confirmed, checked-in, in-progress, completed, cancelled, and no-show; a pack may expose different customer-facing language.

## 5. Industry Pack contract

Every pack is versioned data plus typed extension modules. It may define:

- terminology and pluralization;
- industry accent and icon mapping;
- navigation composition;
- dashboard widget registry;
- service templates and default resource types;
- capabilities and qualifications;
- workflow definitions and transition policies;
- forms, consent, outcome schemas, and validation;
- automation recipes and notification defaults;
- permissions and sensitive-field policies;
- reports and analytics dimensions;
- migration functions between pack versions.

Every pack must validate against the shared schema. Unknown widget, workflow, permission, outcome, or component identifiers fail validation rather than silently degrading.

### Required architecture fixtures

| Pack | Deep workflows used to test the kernel | Accent |
|---|---|---:|
| Driving School | instructors, vehicles, student progress, lesson packages, test readiness | `#F59E0B` |
| Dental | practitioner/chair/room coordination, treatment context, consent, waiting and emergency semantics | `#06B6D4` |
| Salon / Beauty | practitioner skill, room/equipment, service combinations, deposits, retail-friendly follow-up | `#F43F5E` |

Medical, Fitness, Education, Automotive, and Professional Services remain named target packs. They influence terminology and extension design even before their deep implementation.

## 6. Technical architecture

Start as a modular monolith with explicit bounded modules and a durable outbox. Split services only after measured operational pressure proves the need.

```text
apps/
  web/                 current Next.js product-aware shell (staff + public during migration)
  customer-web/        authenticated customer account app/PWA (planned extraction)
  rider-mobile/        transport customer app (planned specialized surface)
  driver-mobile/       driver telemetry and assigned-trip app (planned)
  api/                 composition root and transport
  worker/              outbox, notifications, expiry and reconciliation
packages/
  contracts/           API, event, error, ID and idempotency schemas
  domain/              deterministic domain policies and types
  scheduling/          availability, assignment, holds, conflict rules
  industry-packs/      schema, registry, pack modules
  design-system/       tokens and reusable accessible UI
  auth-client/         OIDC client and session helpers
  observability/       logs, traces, metrics and audit helpers
modules/
  identity-access/
  tenants-entitlements/
  customers-subjects/
  catalog-resources/
  availability/
  bookings/
  packages-billing/
  forms-outcomes/
  notifications/
  integrations/
```

The application directory distinguishes deployable experiences from shared
platform services. It does not imply a separate backend or database per app.
The current `apps/web` remains one Next.js deployment while product and
customer boundaries are extracted behind shared packages. Public booking pages
remain a deliberate no-account path for affordable clients; the customer app
is an optional, authenticated layer over the same customer, booking, ticket,
feedback, and communication contracts. Native customer apps are introduced
only when they provide capabilities a browser cannot reliably provide, such as
transport push notifications, offline tickets, or background journey tracking.

The target product surface model is:

```text
Niu Booking / Care / Transport product shell
  ├── Staff workspace (authenticated operations)
  ├── Public booking pages (guest, QR, no install required)
  ├── Customer account app/PWA (optional sign-in and history)
  ├── Transport rider app (specialized mobile surface)
  └── Driver app (native telemetry and assigned work)
```

Product shells select navigation, terminology, dashboards, and pack modules;
they never duplicate domain invariants. Owner, manager, admin, dispatcher,
staff, and driver are roles or assignments, not automatically separate apps.

Final framework choices should be recorded by ADR after inspecting current repo constraints. Do not select technology solely to match Voice; integration occurs at contracts, identity, and events.

### Data and integration rules

- PostgreSQL is the transactional authority.
- All tenant-owned tables carry an explicit tenant identifier and enforce row-level access defense.
- Domain commands write state and outbox events in one transaction.
- Consumers are idempotent and maintain inbox/deduplication evidence.
- Event and API contracts are versioned and contract-tested.
- Personally identifiable and sensitive industry data has classification, retention, export, and deletion rules.

## 7. Shared identity and authorization

Use the NOVA Better Auth identity service with OAuth 2.1/OIDC Authorization Code + PKCE. The provider authenticates identity; Booking owns current local admission.

Required sequence:

1. Validate issuer, audience, signature, expiry, nonce/state, and PKCE response.
2. Resolve the user by `(identity_issuer, identity_subject)`.
3. Resolve local organization membership and status.
4. Resolve branch scope, role, permissions, and product entitlement.
5. Apply resource-level and sensitive-field policy.
6. Record audit evidence for sensitive actions.

Never treat email, an organization claim, an ID token alone, or a request-body tenant identifier as authorization. Machine-to-machine credentials are separate, scoped, rotatable, revocable, and tenant-bound.

## 8. Voice integration and migration

### Integration boundary

Voice calls a versioned Booking Provider contract:

- search customer;
- list services and locations;
- find feasible slots;
- place/extend/release hold;
- confirm/reschedule/cancel booking;
- fetch booking summary;
- attach call context and attribution.

Voice never writes Booking tables. Booking emits events such as `booking.confirmed`, `booking.rescheduled`, `booking.cancelled`, `customer.updated`, and `followup.requested`. Voice emits `call.started`, `call.ended`, `call.missed`, `transcript.ready`, and `call.booking_linked`.

### Coexistence strategy

1. Document and freeze the existing Voice appointment behavior with characterization tests.
2. Define the provider interface inside Voice.
3. Wrap its current local appointment module in `LocalVoiceBookingProvider`.
4. Implement `RemoteBookingProvider` against the new contracts.
5. Select provider per organization entitlement and migration state.
6. Migrate one tenant at a time with reconciliation reports and rollback.
7. Retire local appointment writes only after event parity and lifecycle verification.

There is no dual-primary period and no dual write.

## 9. Experience plan

### Staff application

- Dark Obsidian compact sidebar; warm off-white canvas; white cards.
- Emerald is reserved for primary actions, focus, active navigation, selected slots, and positive progress.
- Industry accents appear in contextual icons, progress, specialized widgets, and subtle labels.
- Information hierarchy prioritizes exceptions, next actions, and service flow—not decorative metrics.
- Dense calendars and tables remain readable in light and dark modes.
- Every view provides loading, empty, error, offline/retry, permission-denied, and success feedback.

### Customer booking

- Mobile-first, low-friction, WCAG-aware flow.
- Clear service, branch, practitioner/resource preference, slot, details, consent, payment/deposit, and confirmation steps.
- Progressive disclosure avoids asking for irrelevant fields.
- Pack-defined language changes presentation without changing core semantics.
- Recoverable holds and idempotent confirmation prevent duplicate bookings.

## 10. Delivery phases and exit gates

### Phase 0 — Foundation decisions

Deliver context, ADRs, graph, product requirements, pack schema, contract drafts, risk register, and test strategy.

Exit when boundaries, authority, V1, and open decisions are explicit and traceable.

### Phase 1 — Walking skeleton

Deliver workspace, CI, strict typing, database migrations, tenant isolation, OIDC sign-in, local membership, audit skeleton, observability, design tokens, and one authenticated shell.

Exit when a user can sign in, access only an authorized tenant, switch permitted branch, and see verified empty/error states on desktop and mobile.

### Phase 2 — Universal booking kernel

Deliver customer/subject, service, resource/capability, availability, slot search, holds, atomic confirmation, reschedule, cancel, and audit.

Exit when concurrent attempts cannot overbook and the complete lifecycle passes API, persistence, and browser tests.

### Phase 3 — Driving School pack

Deliver students, instructors, vehicles, lesson types, packages, progress, readiness, pack navigation, dashboard, forms, and outcomes.

Exit when a realistic lesson lifecycle works without Driving-specific branches in universal core code.

### Phase 4 — Universality proof

Deliver Dental and Salon fixture packs with representative workflows and rendered screens.

Exit when both reuse the same scheduling kernel and shell, and pack validation catches invalid extensions.

### Phase 5 — Customer portal and operations depth

Deliver public booking, QR destinations and Print Studio, configurable reminders
and feedback, forms/consent, check-in, fulfillment, outcomes, packages,
deposits/payment boundary, analytics, and the authenticated customer web
app/PWA. The customer app must support optional account claim/linking, upcoming
and past bookings, manage/reschedule/cancel links, confirmations, feedback,
communication preferences, and product-aware terminology. It must not replace
guest booking pages: organizations may offer public booking only, customer
accounts only, or both.

Exit when staff, guest customers, and signed-in customers can complete their
respective end-to-end journeys with accessibility and responsive verification,
without exposing staff navigation or tenant internals to customers.

### Phase 5A - Product showcases and specialized customer apps

Create thin product shells for investor/client demonstrations from shared
packages: Niu Booking, Niu Care, and Niu Transport. Keep one web deployment
until independent release cadence or ownership requires extraction. Start a
transport rider app only after the transport ticket/tracking contracts support
push, offline-safe ticket access, scoped live tracking, and honest stale-state
disclosure. Continue treating NIU Driver as a separate native app because
background telemetry and driver permissions are fundamentally different from a
customer browser flow.

Exit when each showcase surface has a real product context, representative
seed/demo tenant, linked navigation, authorization boundary, and browser/mobile
smoke journey; no showcase page may use disconnected mock production data.

### Phase 6 — Voice premium integration

Deliver organization linking, entitlements, provider adapters, events, AI call booking, call linkage, unified timeline, missed-call recovery, and reconciliation.

Exit when Voice books only server-provided valid slots and failures/retries do not create duplicates or split truth.

### Phase 7 — Hardening and pilot

Deliver security review, privacy controls, recovery drills, load/concurrency tests, SLOs, support tooling, onboarding, import/export, billing enforcement, and pilot runbooks.

Exit when pilot tenants pass operational readiness and rollback drills.

## 11. Initial release boundary

Implementation is organized into bounded vertical batches documented in `docs/IMPLEMENTATION_BATCH_PLAN.md`. Each batch must pass backend/frontend parity, tenant-safety, idempotency, migration, and verification gates before the next batch begins.

V1 should include:

- multi-tenant organization and branch access;
- service/resource/capability modeling;
- customer and booking-subject records;
- availability, holds, atomic booking, reschedule, cancel, and no-show;
- staff calendar and operations dashboard;
- mobile-first public booking;
- optional authenticated customer account app/PWA without forcing account creation;
- secure QR booking destinations with attribution and print-safe assets;
- notifications and audit trail;
- configurable appointment reminders and general/post-appointment feedback;
- Driving School pack;
- Dental and Salon architecture fixtures;
- provider contract needed for future Voice integration.

Defer until the kernel is proven:

- broad marketplace/discovery;
- fully autonomous schedule optimization;
- native mobile staff apps;
- deep accounting suite;
- dozens of production-ready packs;
- microservice decomposition;
- highly custom per-tenant workflow scripting.

## 12. Verification matrix

Every slice must identify its applicable gates:

| Gate | Required evidence |
|---|---|
| Static | formatting, lint, typecheck, dependency and secret scans |
| Domain | deterministic policy tests and property/boundary cases |
| Data | migrations, tenant isolation, constraints, concurrent transactions |
| Contract | API/event/provider consumer-provider compatibility |
| Integration | auth, database, notification, payments, Voice adapters |
| Browser | real route, real data, critical journey, explicit states |
| UX | desktop, tablet, mobile, keyboard, reduced motion, contrast |
| Surface parity | backend capability classification, required UI coverage, and no disconnected frontend controls |
| Operations | structured logs, traces, metrics, audit, alert and recovery proof |

Do not merge known failing gates. Quarantine is permitted only for externally flaky tests with an owner, expiry, and tracked remediation.

### 12.1 Experience quality gate — user stories, flows, and language

Every user-facing capability also requires a stable `STORY-*` user story and
`FLOW-*` task-flow record. The flow must show the trigger, pages, decisions,
mutations, handoffs, alternate paths, interruptions, and recovery states from a
real user's point of view. Review the wording at every transition: labels,
headings, helper text, validation, loading, empty, permission, offline,
pending, success, conflict, and error states.

Messages must be understandable to the intended audience without engineering
knowledge. State what happened, what it means, and the clearest next action.
Use progressive disclosure for technical detail; do not hide consequences or
replace a missing explanation with “something went wrong.” Preserve entered
work and distinguish empty, unavailable, denied, expired, and failed states.

Simplifying a flow is not permission to remove a capability. Compare the
before/after capability inventory and record explicit owner approval for any
reordering, renaming, hiding, deferral, or removal. Use
`docs/USER_STORY_AND_FLOW_STANDARD.md` and
`docs/templates/USER_STORY_FLOW_TEMPLATE.md`; attach journey, accessibility,
responsive, and live/deployed evidence to the stable IDs.

For every retained capability, also prove discoverability: the intended user can
find it without knowing an internal name, understand its outcome and current
state, reach setup/configuration, revisit it later, change or disable it safely,
and see what to do next. Contextual links, setup guidance, stable navigation,
and search are valid complementary entrypoints; a backend endpoint or hidden
deep link is not.

### Current owner audit hold — 2026-08-22

The repository gates are currently green for source-level, disconnected browser,
mobile-export, route, parity, migration, and unit coverage. Release acceptance is
still blocked: the public Booking hostname serves the legacy static shell while
the checked-in Next routes return 404, and no authenticated production journey
has been verified. Health endpoints alone are not web-release evidence. The next
deployment must prove every public, auth, and staff route against the production
bridge; `npm run check:deployed-web` now performs that 23-route check, but it
still must be run against the next deployed image, followed by an authorized
tenant journey with real OIDC and persistence. The audited source is now
packaged as immutable release candidate
`3c0291266663bc230595882f107f64a4e6230bd0`, but staging deployment is blocked
because the GitHub `staging` environment has no deployment secrets. Configure
those secrets before retrying the release workflow; do not accept the public
hostname based on API health alone.
The owner audit in `docs/OWNER_AUDIT_2026-08-22.md` is the release checklist and
must remain attached to the deployment record.

## 13. First implementation backlog

1. Initialize repo boundaries, toolchain, CI, line-count check, and documentation lint.
2. Ratify ADRs for stack, tenancy, scheduling concurrency, pack schema, and integration events.
3. Implement design tokens and responsive application shell as a verified vertical slice.
4. Integrate shared OIDC and local tenant authorization.
5. Implement service/resource/capability catalog.
6. Implement availability and deterministic requirement expansion.
7. Implement holds and atomic booking confirmation with concurrency tests.
8. Implement staff schedule and public booking lifecycle.
9. Implement Driving School pack through package/progress/outcome flow.
10. Render Dental and Salon fixtures and remove any leaked vertical assumptions.
11. Add outbox, provider contracts, and Voice characterization/adapters.
12. Pilot behind entitlements with observability and reconciliation.

## 14. Foundation decision status

The recommended defaults are recorded in `docs/DECISION_BRIEF_001_FOUNDATION.md` and proposed ADR-0004 through ADR-0012.

| Decision | Working default | Record |
|---|---|---|
| Stack and repository | Node 24 LTS, npm workspace, strict TypeScript, Next.js, Fastify, `pg`, PostgreSQL | ADR-0004; ADR-0017 |
| Tenant isolation | Shared schema, explicit tenant keys, transactional tenant context, RLS defense | ADR-0005 |
| Scheduling/time/travel | UTC + IANA timezone, half-open intervals, bounded horizons, travel policy port | ADR-0006 |
| Payments/packages | Provider-neutral payments and append-only entitlement ledger | ADR-0007 |
| Public identity | Guest-first verified contact, expiring booking-management capability, optional account claim | ADR-0008 |
| Voice transport | OpenAPI commands and outbox-backed signed webhooks | ADR-0009 |
| Pack customization | Versioned reviewed packs with schema-bounded tenant overrides | ADR-0010 |
| Commercial model | Capability entitlements behind Booking Essentials, Operations, Voice, and Premium | ADR-0011 |
| Deployment | Portable containers; production provider/region gated by launch review | ADR-0012 |
| Realtime fleet tracking | NIU telemetry authority, Traccar mobile SDK, session-scoped hashed/revocable provider credentials, optional private hardware forwarder, scoped staff/rider projections | ADR-0018; BATCH-005 |
| Transit interoperability | Versioned validated GTFS Schedule before GTFS-Realtime; stable public IDs; fixed, headway, flexible, fare, accessibility, and extension seams | ADR-0019 |

The launch country, production provider/region, recovery targets, payment providers, exact pricing, quotas, taxes, and communication providers remain explicit business decisions. They do not block a local walking skeleton because their adapters and policy seams are defined, but they block real production data and payment traffic.
