# Codex Project Context

> **Deployment status (2026-08-13): NOT DEPLOYED.** `booking.niuautomations.com`
> resolves to the shared host but nothing serves it. There is no Dockerfile, no
> compose file, no migration runner, and this directory is **not a git
> repository**. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for what is missing, the
> deployment pattern already established by NOVA POS and NOVA Identity on the
> same host, and the traps those deployments already paid for.
>
> The blocking issue is not technical: **Booking and the Voice Platform both
> implement appointments and both implement feedback.** Deploying Booking before
> the ownership map in `DEPLOYMENT.md` is settled creates two live systems that
> each believe they own the same records. The `BookingProvider` boundary
> described below is the resolution — and it is the product *tiering* mechanism,
> not a migration path.

## Mission

Design and build a universal, intelligent Booking and Service Operations platform that can be purchased independently and becomes deeply specialized through Industry Packs. Integrate it with the existing Voice Platform for premium customers without making Booking depend on telephony infrastructure.

The long-term product is the coordination layer for service businesses:

```text
Discover -> Book -> Pay -> Prepare -> Arrive -> Deliver -> Record Outcome -> Follow Up -> Rebook
```

Booking is the entry point, not the ceiling. The platform should eventually transform customer demand into feasible, optimized, explainable service delivery.

## Product family

### Booking

The accessible standalone product. It owns customers, booking subjects, branches, services, resources, capabilities, availability, bookings, packages, forms, fulfillment, outcomes, and operational analytics.

### Voice

The existing separately purchasable communications product. It owns phone infrastructure, queues, calls, recordings, transcripts, AI conversations, callbacks, and quality analytics.

### Premium Operations Suite

Booking plus Voice plus cross-product intelligence:

- AI telephone booking against real Booking availability;
- customer recognition and screen-pop;
- call-to-booking linkage;
- unified activity timeline;
- missed-call demand recovery;
- outbound voice reminders and follow-up;
- call-to-booking-to-outcome analytics;
- disruption recovery and operational copilot.

## Existing Voice foundation

`C:\Users\Blurok\Documents\voice-platform` already contains a substantial appointment implementation: services, resources, availability, PostgreSQL exclusion constraints, slot holds, manual/public/AI booking, transcript suggestions, reminders, QR booking pages, ICS, and calendar UI.

Reuse its proven algorithms, tests, failure lessons, and interaction doctrines. Do not preserve its single-resource appointment shape as the universal model. The Booking kernel must support atomic multi-resource allocations, capabilities, capacity, branches, subjects, packages, workflow, and outcomes.

Use a strangler/provider boundary in Voice:

```text
BookingProvider
  LocalVoiceBookingProvider   # legacy / Scheduler Lite
  RemoteBookingProvider       # Booking Core source of truth
```

Never dual-write both booking stores.

## Universal service-delivery model

A booking is not merely person + service + time. It is:

```text
demand + participants + subjects + requirements + resources + constraints
+ capacity + location + workflow + commercial rules
```

Core primitives:

- Organization and Branch
- Customer and Booking Subject
- Staff and Resource
- Resource Type and Capability
- Service and Service Variant
- Requirement Slot and Constraint
- Availability Rule and Exception
- Booking and Booking Occurrence
- Participant and Resource Allocation
- Location and Service Zone
- Package, Credit, Membership, and Entitlement Ledger
- Forms, Custom Records, Workflow, Rules, Communications, and Analytics
- QR destinations with opaque public codes, attribution, revocation, and print-safe assets
- Consent-aware feedback campaigns, survey versions/responses, reminder schedules, and delivery attempts

## Industry Packs

Industry Packs are versioned, validated operational blueprints. They configure:

- terminology;
- navigation and enabled modules;
- dashboards and widgets;
- default resource types and capabilities;
- service and requirement templates;
- workflows, forms, custom records, rules, reports, and automations;
- contextual UI panels and customer portal behavior.

Packs do not own tenant data, execute arbitrary uploaded code, or fork the application.

The initial architecture tests are:

- Driving School: instructors, vehicles, packages, progress, pickup, travel, multi-resource allocation.
- Dental: practitioners, assistants, rooms/chairs, prerequisite forms, queue, treatment workflow, follow-up.
- Salon: simple appointments, staff selection, optional resources, preferences, repeat booking.

Driving School is the first deep implementation. Dental and Salon remain first-class acceptance fixtures from the beginning.

## Design direction

Booking must look distinct from the Voice interface and more modern, calm, and operational.

Core identity:

- Obsidian sidebar: `#111827`
- Emerald primary action: `#10B981`
- Deep Emerald: `#047857`
- Mint surface: `#D1FAE5`
- Warm canvas: `#F7F8F6`
- Cards: `#FFFFFF`
- Primary text: `#171717`
- Secondary text: `#64748B`
- Border: `#E5E7EB`

Industry accents are restrained:

- Driving School: Amber `#F59E0B`
- Dental: Aqua `#06B6D4`
- Medical: Teal `#0D9488`
- Salon: Rose `#E11D48`
- Fitness: Orange `#F97316`
- Education: Sky `#0EA5E9`
- Automotive: Blue `#2563EB`
- Professional Services: Emerald `#059669`

Primary actions remain Emerald across industries. Industry colors identify domain-specific widgets, progress, icons, and contextual information.

## Authentication

Use the shared NOVA Better Auth identity provider at the planned issuer `https://novaauth.niuautomations.com`.

- Browser and mobile clients use Authorization Code + PKCE.
- Booking maps `(identity_issuer, identity_subject)` to a local user.
- Booking owns current tenant membership, roles, permissions, branch access, entitlements, RLS context, and domain audit.
- Tokens prove identity, not tenant authorization.
- Voice and Booking remain separate OAuth clients and separate local authorization domains.

## Architecture

- Begin as a modular monolith with a separately testable scheduling domain.
- PostgreSQL is the transactional source of truth.
- Use range/exclusion constraints for capacity-one resource allocations.
- Use stable locking and transactional capacity checks for shared capacity.
- Use transactional outbox and idempotent consumers for integration events.
- Keep provider integrations behind ports/adapters.
- Use OpenAPI and versioned event schemas from one contracts package.
- Store instants in UTC and preserve the IANA timezone used for local interpretation.
- Use half-open `[start, end)` intervals.

## Non-negotiable quality doctrine

- Build to verify.
- No source file should grow beyond approximately 300 lines; split by responsibility.
- Use focused shared components and modules.
- Test business invariants, tenant isolation, authorization, concurrency, integrations, accessibility, and responsive behavior.
- A feature is not done because CRUD or a mock exists. Its intended lifecycle must work through the real UI and real persistence boundary.
- Never invent production data to make a screen look complete.

## Instructions to Codex

Before major implementation:

1. Inspect the current repository and Git state.
2. Query Graphify for relevant architecture and file relationships.
3. Read applicable ADRs and skills.
4. State the invariant, source-of-truth boundary, failure modes, and verification plan.
5. Implement the smallest coherent vertical slice.
6. Run all proportional gates and fix failures.
7. Render and inspect UI changes at desktop, tablet, and mobile.
8. Update planning, ADRs, Graphify, and Obsidian when durable relationships change.
