# Universal Intelligent Booking & Service Operations Platform

## Expert Product and Architecture Plan

Date: 2026-08-12

Source reviewed: `graphify-booking-corpus/booking-platform-handoff.md`

## Executive judgment

The strongest idea in the handoff is not “booking for many industries.” It is the separation between:

1. a deterministic service-delivery kernel;
2. versioned Industry Packs that compose that kernel;
3. specialized experiences built from shared components; and
4. intelligence that proposes or explains actions without bypassing the kernel.

That is a credible platform thesis. The main danger is trying to prove the entire thesis at once. The document currently combines a core scheduler, vertical product design, workflow/rules/forms platforms, communications, payments, analytics, AI operations, routing, an SDK, and a marketplace. Those are multiple products.

The recommended strategy is:

> Build one commercially coherent Driving School product, make Dental a configuration/architecture test, and use Salon as the simplicity test. Prove the universal mechanics through executable scenarios before expanding the product surface.

The first release should prove only three hard claims:

- one booking can atomically reserve several compatible resources;
- one versioned Industry Pack can materially change terminology, navigation, defaults, workflows, and UI composition without forking the application;
- a specialized operational workflow can be delivered using universal primitives plus typed extensions.

## What is already strong

- Booking is correctly modeled as constrained demand, not merely a person and a time slot.
- Resources, capabilities, capacity, location, workflow, and commercial rules are treated as first-class.
- “Customer” is separated from the optional subject receiving the service.
- The document explicitly keeps AI out of the availability source of truth.
- Industry specialization includes workflows and modules, not cosmetic relabeling.
- Driving, Dental, and Salon create a useful triangle: operationally complex, clinically complex, and intentionally simple.
- The three UX complexity levels are an important defense against exposing platform internals to small businesses.

## Necessary corrections to the current framing

### 1. Choose a beachhead, not merely a test vertical

Driving School should be the first product and initial buyer hypothesis, not just a sample theme. It exercises multi-resource assignments, credits, progress, pickup locations, continuity, and mobile staff workflows while avoiding the clinical-data risk of Dental.

Dental should initially be a non-production architecture fixture. Do not store clinical notes or claim healthcare compliance until privacy, retention, audit, access-control, and jurisdictional requirements are deliberately designed.

Salon should be a regression fixture ensuring the universal model does not force complex resource concepts into a business that needs straightforward appointments.

### 2. “Universal” must mean composable, not infinitely configurable

A platform that makes every field, state, rule, and screen dynamic becomes hard to reason about, test, query, migrate, and support. Use three extension mechanisms:

- stable universal domain entities for transactional invariants;
- typed, versioned configuration for Industry Pack behavior;
- explicit custom records/fields for non-critical vertical data.

Do not put scheduling-critical data solely in generic JSON. Transmission, qualification, capacity, branch, and time constraints need queryable, indexed representations even if their definitions originate in a pack.

### 3. Separate state machines

One giant configurable booking status will become contradictory. Keep related but distinct lifecycles:

- booking commercial state: draft, held, confirmed, cancelled;
- fulfillment state: assigned, ready, in progress, completed;
- attendance state: expected, checked in, no-show;
- payment state: unpaid, partially paid, paid, refunded;
- approval state where a request workflow requires it.

Industry Packs may label or compose these, but core invariants remain explicit.

### 4. Separate availability search from reservation commit

Availability is an advisory computation. Booking is a concurrency-controlled transaction. A slot returned at 10:00 can disappear before the customer confirms it. The product needs expiring holds, idempotent commands, deterministic lock ordering, conflict errors, and retries.

### 5. Treat permissions, audit, privacy, and time as core domain concerns

The handoff under-specifies:

- tenant and branch isolation;
- staff roles and field-level access;
- immutable audit history;
- customer consent and communication preferences;
- data retention and deletion;
- timezone and daylight-saving behavior;
- idempotency and duplicate webhook handling;
- resource maintenance/unavailability;
- external-calendar ownership and synchronization conflicts.

These are not late infrastructure polish. They affect the entity model.

## Product boundary for the first pilot

### In scope

- organization, branch, staff membership, and permissions foundation;
- Driving School Industry Pack and onboarding defaults;
- students and optional booking subjects;
- instructors, vehicles, capabilities, availability, and maintenance blocks;
- services and resource requirements;
- calendar with instructor and vehicle views;
- create, hold, confirm, reschedule, cancel, start, and complete a lesson;
- atomic instructor-plus-vehicle allocation;
- packages and a simple append-only lesson-credit ledger;
- lesson assessment and progress record;
- customer-facing booking flow;
- staff “Today” mobile-responsive workflow;
- basic confirmations/reminders through one channel;
- audit trail and operational event outbox;
- Dental configuration prototype using the same shell and components;
- Salon scheduling fixtures in automated tests.

### Explicitly deferred

- natural-language booking and AI-generated packs;
- general visual rules/workflow/automation builders;
- route optimization and dispatch;
- pack marketplace and third-party executable extensions;
- arbitrary custom analytics;
- multi-channel communications orchestration;
- full accounting, insurance, or clinical records;
- enterprise organization hierarchies;
- advanced waitlist ranking;
- dark mode unless it falls out cheaply from design tokens.

Deferral should mean the architecture leaves a seam, not that placeholder frameworks are built now.

## Universal versus Industry Pack-controlled

| Concern | Universal kernel | Industry Pack | Organization override |
|---|---|---|---|
| Identity and tenancy | organizations, branches, users, memberships | recommended roles | staff assignments and permissions |
| Customer model | party/customer, contacts, subject relation | labels and subject types | custom fields and visibility |
| Resources | resource, type, capability, calendar, status | default resource types/capabilities | actual resources and local attributes |
| Services | duration, buffers, price basis, requirements | service templates and labels | services, pricing, availability |
| Scheduling | requirement expansion, availability, holds, allocations, conflict rules | default policies and assignment strategies | enabled strategies and weights |
| Capacity | universal capacity policies and allocations | defaults per service pattern | configured limits |
| Workflow | safe core transition engine | versioned workflow templates | limited allowed overrides |
| Navigation | slot/route registry | visible modules, ordering, terminology | pinning and permissions-based visibility |
| Dashboard | widget registry and layout engine | widget set and default layout | personal/organization layout |
| Forms | form schema and submissions | default forms and lifecycle hooks | questions, consent copy, required fields |
| Custom records | typed schema and record engine | record type definitions | added fields/templates |
| Communications | templates, consent, delivery records | default lifecycle messages | branding, copy, channel settings |
| Analytics | canonical events and metric definitions | vertical metrics/widgets | goals and saved views |

The pack should never own tenant data, execute arbitrary code, or modify database constraints directly.

## Industry Pack representation

Represent a pack as a versioned, schema-validated manifest plus referenced templates:

```text
IndustryPack
  id
  version
  compatibilityVersion
  terminology
  enabledCapabilities
  navigation
  dashboards
  resourceTypeTemplates
  capabilityDefinitions
  serviceTemplates
  workflowTemplates
  formTemplates
  customRecordSchemas
  ruleTemplates
  metricDefinitions
  experienceVariants
```

Key design rules:

- Pack versions are immutable after publication.
- An organization pins a version and upgrades through an explicit migration/preview.
- Installation creates tenant-owned instances from templates; it does not make live tenant data depend on mutable global defaults.
- Configuration is validated against JSON Schema or an equivalent typed schema.
- Overrides use documented merge semantics. Avoid unrestricted deep merges.
- Pack expressions use a small, safe, bounded expression language. Never evaluate uploaded JavaScript.
- Every pack-controlled component references a registry key such as `dashboard.student_progress`, not a source-code import path.
- The resolved configuration is compiled and cached per organization/pack version.
- Feature availability and authorization are separate. A visible module does not grant access.

## Scheduling and resource model

### Core concepts

- `ServiceDefinition`: the sellable/operational service.
- `ServiceVariant`: duration, buffers, pricing, and requirement differences.
- `RequirementSlot`: a need such as one manual-certified instructor and one manual vehicle.
- `Resource`: any allocatable asset, including a staff member when acting as capacity.
- `Capability`: typed attribute usable by requirement predicates.
- `AvailabilityRule`: recurring working window.
- `AvailabilityException`: leave, maintenance, holiday, or one-off override.
- `BookingRequest`: demand, participants, subject, service, location, and preferences.
- `BookingOccurrence`: a concrete session; courses and recurrence are groups of occurrences.
- `Allocation`: resource, occurrence, role, and reserved time range including buffers.
- `Hold`: expiring provisional allocations.
- `EntitlementEntry`: append-only credit grant, consumption, release, or adjustment.

Staff and resources should not become unrelated parallel models. A staff profile represents employment/identity; its associated resource represents allocatable time and capabilities.

### Availability pipeline

```text
Booking request
  -> resolve service variant and pack/organization policies
  -> expand requirement slots
  -> find capability-compatible candidate resources
  -> intersect working hours, exceptions, existing allocations, location, and capacity
  -> form valid resource combinations
  -> score combinations by explicit objectives
  -> return explainable offers with expiry
  -> create hold
  -> confirm all allocations in one transaction
  -> write booking events to an outbox
```

Each rejected candidate should have machine-readable reason codes. This makes “why is 10:00 unavailable?” supportable and gives future AI a truthful explanation layer.

### Concurrency invariants

- Use half-open intervals `[start, end)` so adjacent bookings do not overlap.
- Persist instants in UTC and preserve the organization/location IANA timezone used to interpret local schedules.
- Include preparation, cleanup, and travel buffers in allocation ranges.
- For capacity-one resources, enforce non-overlap at the database boundary. PostgreSQL range types and exclusion constraints are a strong fit.
- For capacity greater than one, lock the affected capacity record/bucket and verify aggregate allocations inside the transaction, or represent discrete capacity units where practical.
- Acquire resource locks in stable resource-ID order to reduce deadlocks.
- Use serializable transactions for the booking commit path where appropriate and retry serialization failures.
- Every create/reschedule/payment webhook command carries an idempotency key.
- Rescheduling creates the new hold before releasing the old confirmed allocations where policy permits.

Do not pre-generate every possible slot indefinitely. Derive availability within a bounded search horizon and cache results with invalidation keyed to resource/calendar changes.

## Recommended data model

### Tenancy and access

- `organization`
- `branch`
- `user`
- `organization_membership`
- `role`, `permission`, `role_binding`
- `audit_entry`

Every tenant-owned row carries `organization_id`; branch-scoped rows also carry `branch_id`. Enforce tenant isolation in application queries and add database row-level security as defense in depth after threat-modeling operational access.

### Parties and relationships

- `party` for a person or organization identity
- `customer_account`
- `booking_subject`
- `party_relationship` for parent/child, owner/vehicle, company/equipment
- `contact_point`, `address`, `consent`

Avoid a single enormous `customer` table and avoid making every subject a pseudo-customer.

### Catalog and resources

- `service_definition`, `service_variant`
- `resource`, `resource_type`
- `staff_profile`, `staff_resource_link`
- `capability_definition`, `resource_capability`
- `service_requirement`, `requirement_predicate`
- `location`, `service_zone`
- `availability_rule`, `availability_exception`

### Booking and fulfillment

- `booking`
- `booking_occurrence`
- `booking_participant`
- `booking_requirement_snapshot`
- `resource_allocation`
- `booking_hold`
- `booking_transition`
- `fulfillment_record`

Snapshot the service requirements, price, duration, buffers, and relevant labels on confirmation. Historical bookings must not silently change when a service or pack is edited.

### Commercial and engagement

- `package_definition`, `entitlement_account`, `entitlement_entry`
- `payment_intent`, `payment`, `refund`
- `form_definition`, `form_version`, `form_submission`
- `communication`, `delivery_attempt`
- `timeline_event`
- `outbox_event`, `webhook_delivery`

Keep money and credits as append-only ledger-like records with reversals; do not merely mutate a remaining-balance field.

### Vertical extension

- `custom_record_type`
- `custom_field_definition`
- `custom_record`
- `custom_record_value` or validated JSON payload with indexed promoted fields

High-volume or invariant-critical vertical concepts can graduate into typed modules later. The custom-record engine is an extension seam, not a substitute for domain modeling.

## Recommended application architecture

Start with a modular monolith, not microservices.

```text
Web/admin + public booking + responsive staff experience
  -> contract-first application API
  -> modular domain/application layer
       tenancy and access
       parties/customers
       catalog
       resources and calendars
       scheduling
       bookings and fulfillment
       entitlements/payments
       packs and configuration
       communications
  -> PostgreSQL
  -> transactional outbox + background worker
  -> external providers through adapters
```

Suggested greenfield stack, subject to an existing-repository inspection:

- TypeScript monorepo.
- Next.js App Router for admin, portal, and public booking experiences.
- A separately deployable TypeScript API/worker organized as a modular monolith; use REST/OpenAPI contracts so public APIs and non-web clients are not coupled to React server internals.
- PostgreSQL as transactional source of truth.
- PostgreSQL-backed jobs initially; add Redis only for demonstrated caching/rate-limit needs.
- Object storage for documents.
- OpenTelemetry-compatible logs, traces, and metrics.

Keep the scheduler as a pure domain package with deterministic inputs/outputs and no dependency on UI, HTTP, messaging, or payment providers. Keep integrations behind ports/adapters. Emit domain events into a transactional outbox in the same commit as the state change; workers then deliver notifications, analytics events, and webhooks.

Do not adopt workflow orchestration, a dedicated rules engine, an event broker, or separate services until operational requirements justify them.

## Frontend component architecture

Use four layers:

1. **Design primitives**: buttons, inputs, tables, drawers, dialog, command palette, tokens, typography.
2. **Domain components**: booking card, resource badge, availability picker, timeline, allocation list, entitlement balance.
3. **Capability features**: calendar, create-booking flow, customer profile, resource profile, queue.
4. **Pack composition**: terminology, navigation, dashboard layout, enabled features, record panels, and contextual renderers.

Universal components receive domain terms and behavior through resolved pack context. Avoid both extremes:

- no `DrivingSchoolDashboard.tsx` fork containing a private application;
- no hyper-generic `DynamicRenderer` that turns the entire UI into untyped configuration.

Allow pack-specific panels through a typed slot registry. Example: the universal customer profile owns header, actions, tabs, timeline, loading/error/empty behavior; the Driving School pack contributes a typed course-progress panel and lesson-assessment tab.

The calendar should use a normalized view model rather than reading raw booking rows. Virtualize dense resource columns, preserve keyboard navigation, expose conflicts accessibly, and keep the booking drawer URL-addressable so refresh/back behavior works.

## Build plan and exit gates

### Phase 0 — Product and architecture decisions

Deliverables:

- identify the first buyer, operator, and booking actor;
- write 15–20 executable scheduling scenarios across the three verticals;
- define tenant, branch, role, and privacy boundaries;
- agree the v1 Driving School workflow and vocabulary;
- create architecture decision records for pack versioning, scheduling concurrency, data extension, and API style;
- define success metrics and pilot constraints.

Exit gate: the team can state what the first customer pays for and can manually evaluate each scheduling scenario without ambiguous rules.

### Phase 1 — Experience and configuration prototype

Use realistic mock data to build:

- application shell and design tokens;
- pack-driven navigation and terminology;
- Driving School dashboard;
- resource/staff calendar and booking drawer;
- guided create-booking flow;
- students, instructors, vehicles, and profiles;
- public booking flow;
- Dental mode rendered from the same registries and component architecture.

Exit gate: removing the logo still leaves each mode visibly specialized, and switching packs does not switch to a separate application tree.

### Phase 2 — Domain kernel and scheduler spike

Build the minimal API and database for tenancy, catalog, resources, capabilities, schedules, exceptions, bookings, holds, and allocations. Implement atomic instructor-plus-vehicle reservations and concurrency tests.

Test cases must include:

- two users trying to take the same instructor/vehicle combination;
- adjacent bookings with buffers;
- branch and timezone boundaries;
- maintenance exceptions;
- capability mismatch;
- a group-capacity service;
- reschedule rollback when the new allocation fails;
- idempotent duplicate confirmation.

Exit gate: randomized and concurrent tests cannot create an invalid allocation.

### Phase 3 — Driving School pilot slice

Connect the prototype to the domain kernel. Add packages/credits, lesson assessments, course progress, staff Today view, one communication channel, audit entries, and basic operational reporting.

Exit gate: a small driving school can configure resources and services, accept a valid booking, deliver and complete a lesson, consume a credit, record the outcome, and see the history without manual database intervention.

### Phase 4 — Architecture proof across verticals

- Dental fixture: practitioner + assistant + room/chair, prerequisite form, queue-state presentation.
- Salon fixture: simple staff/service appointment with optional chair.
- Measure how much new code versus configuration each vertical requires.

Exit gate: new mechanics produce reusable capability modules; terminology, defaults, layout, and composition remain pack configuration. No copied application shell or booking engine.

### Phase 5 — Pilot hardening

Add import/export, backups, rate limiting, accessibility audit, observability, support tooling, privacy/retention workflows, failure recovery, and external-provider reconciliation. Only then decide whether payments, WhatsApp, calendar sync, travel, or waitlists are the next commercial priority.

## Metrics that should guide scope

- time from onboarding to first bookable service;
- valid-booking completion rate;
- scheduler response latency at p50/p95;
- conflict rate after confirmation (target: zero internal conflicts);
- percentage of bookings manually reassigned;
- reschedule/cancellation completion rate;
- resource utilization and unallocated demand;
- weekly active operators and lessons completed;
- support cases caused by pack terminology/configuration;
- vertical implementation ratio: configuration changes versus new domain code.

Avoid measuring the platform by number of modules or AI features shipped.

## Architectural traps

1. **Entity-attribute-value everywhere**: flexible initially, painful for constraints, reporting, and migrations.
2. **One status field**: commercial, attendance, fulfillment, and payment states collide.
3. **Availability equals empty calendar**: ignores capabilities, buffers, capacity, location, credits, and concurrent confirmation.
4. **UI labels as domain concepts**: renaming Customer to Student must not alter API/database semantics.
5. **Pack as arbitrary code**: creates security, upgrade, and support problems.
6. **Mutable pack defaults**: an upgrade unexpectedly changes live tenant behavior.
7. **AI-generated production rules without review**: creates silent operational risk.
8. **Microservices before invariants are understood**: makes atomic multi-resource reservation harder.
9. **Event-driven everything**: booking confirmation must remain transactionally consistent; events distribute consequences afterward.
10. **Building Dental clinical records early**: introduces privacy and compliance scope unrelated to proving scheduling.
11. **Ignoring time semantics**: DST, local working hours, and recurring schedules create subtle corruption.
12. **Over-designing visual builders**: rules/workflow/form builders can consume the entire roadmap before product-market fit.
13. **External calendar as the source of truth**: sync lag and recurrence semantics can invalidate guarantees.
14. **Personalization before explainability**: operators must understand why a resource/time was selected.

## Decisions needed before implementation

1. Which country and regulatory environment is the initial market?
2. Who is the first paying buyer: owner, operations manager, or franchise group?
3. Is customer self-booking essential to the first pilot, or is staff booking dominant?
4. What exact Driving School lesson lifecycle is common enough for v1?
5. Are pickup locations fixed zones or arbitrary addresses in the first release?
6. Must packages be paid online in v1, or can the platform record offline payment?
7. Is instructor preference a hard constraint or a scored preference?
8. Can a vehicle change after confirmation, and who may change it?
9. Which communication channel is essential in the target market?
10. What data may staff at one branch see about another branch?
11. Does the system need external calendar sync at launch?
12. What pilot scale should concurrency and availability latency target?

## Recommended immediate next move

Do not scaffold the whole application yet. Conduct a short architecture/product-definition sprint producing:

- a one-page v1 product boundary;
- 15–20 scheduling scenario tests;
- the v1 Industry Pack schema;
- the core entity relationship diagram;
- four architecture decision records;
- low-fidelity flows for create booking, reschedule, lesson completion, and package consumption;
- a high-fidelity shell/calendar/drawer prototype with Driving and Dental configurations.

After review, implement the scheduler concurrency spike before committing to the full backend.

## Reference notes

- PostgreSQL range types and exclusion constraints directly support non-overlapping reservation ranges: https://www.postgresql.org/docs/16/rangetypes.html
- PostgreSQL serializable transactions require whole-transaction retries on serialization failure: https://www.postgresql.org/docs/17/transaction-iso.html
- PostgreSQL row-level security can provide default-deny, per-row policies as defense in depth: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- Next.js currently recommends the App Router for new applications and documents layouts, loading/error boundaries, Server Components, and multi-tenant patterns: https://nextjs.org/docs/app
- OpenFGA documents organization-parent authorization for multi-tenant SaaS; consider it only if relationship-based authorization outgrows a simpler in-application RBAC model: https://openfga.dev/docs/use-cases/multi-tenant-saas
