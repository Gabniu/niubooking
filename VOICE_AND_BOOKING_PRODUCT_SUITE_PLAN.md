# Voice + Booking Product Suite Plan

Date: 2026-08-12

Repositories reviewed:

- `C:\Users\Blurok\Documents\voice-platform`
- `C:\Users\Blurok\Documents\bookingapp`

## Executive decision

Build a suite of independently purchasable products around one customer organization:

1. **Booking & Service Operations** — the source of truth for customers, booking subjects, services, resources, availability, bookings, packages, workflows, fulfillment, and outcomes.
2. **Voice Operations** — the source of truth for phone numbers, calls, queues, agents, recordings, transcripts, AI conversations, handoffs, and call quality.
3. **The Integrated Suite** — shared identity, entitlements, navigation, customer resolution, event history, and cross-product workflows. Voice becomes a first-class interaction channel into Booking.

The products must remain useful separately. Their integration must happen through versioned APIs and durable events, never shared tables or one repository importing the other.

The premium offering is not “two apps bundled together.” It is a closed operational loop:

```text
Customer calls
  -> Voice recognizes the customer and intent
  -> Booking returns truthful availability and eligibility
  -> Voice offers concrete options
  -> Customer confirms
  -> Booking atomically reserves resources
  -> Both products show one linked interaction
  -> Booking owns reminders and service delivery
  -> Voice handles follow-up calls, missed-call recovery, and escalations
  -> Suite analytics measures call-to-booking-to-outcome conversion
```

## What exists in Voice Platform today

This is not an early prototype. The repository reports and implements:

- Django/DRF backend, PostgreSQL, Redis/Channels, React 19/Vite frontend, and React Native mobile app.
- Asterisk PBX, LiveKit AI/media, ARI call orchestration, queues, browser/mobile softphones, call flows, recordings, transcripts, QA, analytics, webhooks, and multi-organization support.
- Real shared-product seams already anticipated: scoped API keys, signed outbound webhooks, inbound caller lookup, and HTTP-only CRM integration.
- A substantially complete appointment module:
  - services and resources;
  - schedule-based availability;
  - PostgreSQL overlap protection;
  - expiring slot holds;
  - manual, public, AI-call, and transcript-suggestion creation paths;
  - reminders, public booking pages, QR codes, and ICS feeds;
  - appointment calendar and administration UI.

This existing appointment work should be respected and harvested. It should not be mistaken for the universal Service Operations kernel described in the booking handoff.

## Why the current Voice appointment model cannot be the final shared kernel

The Voice model is a good appointment system and a strong integration prototype. Its core shape is still:

```text
Appointment -> one ServiceType + one Resource + one time interval
```

The universal booking thesis requires:

```text
Booking occurrence
  -> many requirement slots
  -> many atomic resource allocations
  -> participants and booking subject
  -> capability predicates
  -> capacity policies
  -> branch/location/travel constraints
  -> commercial entitlements
  -> fulfillment workflow and outcomes
```

Specific gaps between the existing Voice appointment module and the planned Booking kernel:

- `Appointment.resource` is singular; driving and dental scenarios need several simultaneous allocations.
- `ServiceResource` says which resource may deliver a service, but does not express required resource roles, quantities, alternatives, or capability predicates.
- Capacity greater than one is acknowledged but is not enforced by the database exclusion constraint.
- Contacts are identified primarily through telephone-number normalization; the Booking platform needs customers, organizations, booking subjects, relationships, and multiple contact points.
- There is no first-class branch, service location, travel, package-credit ledger, booking-participant, or fulfillment model.
- Appointment status combines several lifecycles that the larger platform should separate.
- Most date behavior is deliberately Nairobi-specific today.
- Appointment events currently travel through a call-oriented event mechanism.
- Outbound webhooks are background threads rather than a durable transactional outbox.
- Local JWT users and local organization IDs are not yet a suite-wide identity contract.

These are not criticisms of the Voice implementation. They show that Phase S solved the problem it was designed to solve, while the new Booking platform has a larger domain.

## What should be reused

Reuse concepts, behavior, tests, and proven patterns—not database ownership.

### Reuse directly or port carefully

- PostgreSQL range/exclusion-constraint strategy for capacity-one allocations.
- Half-open interval semantics (`[start, end)`).
- Pure availability-core approach with framework-free tests.
- Slot holds as advisory offers, with database enforcement at confirmation.
- Deterministic concrete-choice interaction for AI booking.
- Human confirmation before a side-effecting AI action.
- Transcript-detected booking suggestions that never auto-create bookings.
- Reminder idempotency and explicit terminal delivery states.
- Public token-scoped cancellation/rescheduling.
- ICS behavior and its honest “publication, not synchronization” limitation.
- Real concurrency and end-to-end verification discipline.

### Do not copy forward as permanent suite architecture

- A singular `Appointment.resource` foreign key.
- Phone number as customer identity.
- `Org.objects.first()` fallbacks for tenant resolution.
- App-local integer organization IDs as cross-product identifiers.
- Fire-and-forget thread delivery for important business events.
- A second independent customer timeline in every product.
- A second booking database remaining writable in combined-product mode.

## Product packaging and entitlements

Model product access as organization-level entitlements, independent of user roles.

| Offer | Booking | Voice | Integrated capabilities |
|---|---:|---:|---|
| Booking Core | Yes | No | Public booking, resources, calendar, operations |
| Voice Core | No or lightweight callback only | Yes | PBX, queues, AI receptionist, call intelligence |
| Operations Suite | Yes | Yes | Voice booking, customer screen-pop, unified history, linked analytics |
| Operations Intelligence | Yes | Yes | Disruption planning, recovery automation, forecasting, optimization |

Suggested machine-readable capabilities:

```text
booking.core
booking.public_portal
booking.pack.driving_school
voice.core
voice.ai_operator
voice.recording_intelligence
suite.customer_context
suite.voice_booking
suite.unified_timeline
suite.cross_product_automation
suite.operations_intelligence
```

Do not scatter plan-name checks such as `if plan == "premium"` through either application. Resolve entitlements into capabilities and gate routes, modules, API operations, and navigation with those capabilities.

Billing may sell bundles, seats, branches, call minutes, AI minutes, or booking volume. Product code should consume entitlements and usage limits; it should not encode commercial package names.

## Shared identity and control plane

Use the shared NOVA identity provider as the identity authority and OAuth/OIDC issuer. Each application remains responsible for local admission and authorization.

### Identity provider owns

- stable user subject (`sub`);
- sign-in, recovery, verification, MFA, and identity sessions;
- OAuth clients and discovery;
- platform-level user lifecycle.

### Suite control plane owns

- global organization identity (`platform_org_id`, preferably UUID/ULID);
- product subscriptions and entitlements;
- product-instance registrations and environments;
- service credentials and revocation;
- high-level usage ingestion for billing;
- suite launcher/product discovery;
- immutable entitlement/configuration audit.

### Each product owns locally

- a mapping from identity `sub` to its local user;
- a mapping from `platform_org_id` to its local tenant row;
- current membership, roles, permissions, branch access, and support elevation;
- product-specific sessions and audit records.

Never treat email, an organization token claim, or an identity-provider session as proof that a user may enter a tenant. Both products must check their current local membership.

### Migration from Voice local JWT auth

Do not replace auth in one release. Use a staged adapter:

1. Add `identity_subject` to Voice users and `platform_org_id` to Voice organizations.
2. Keep existing JWT login working while OIDC Authorization Code + PKCE is introduced.
3. Link existing accounts through a controlled authenticated flow; do not auto-link only by email.
4. Create local Voice sessions after OIDC callback and local tenant admission.
5. Prove login, logout, disabled-user, revoked-membership, multi-org switching, support elevation, and rollback.
6. Retire password login only after every active tenant is mapped and recovery paths are proven.

The Booking web application follows the same OIDC contract from its first real implementation.

## Deployment topology

The architecture must support different commercial and infrastructure realities.

### Booking-only customer

```text
Browser/mobile
  -> Shared Identity
  -> Booking application/API
  -> Booking PostgreSQL + workers
```

### Combined customer with hosted Voice

```text
Shared Identity + Suite Control Plane
        |                    |
Booking Cloud <----API/events----> Voice Platform
        |                    |
Booking DB              Voice DB + Asterisk/LiveKit
```

### Combined customer with on-premise or Kenya-hosted Voice edge

```text
Booking Cloud
   ^       |
 HTTPS     | signed durable events
   |       v
Client/region Voice edge
  Asterisk + LiveKit + Voice API + local operational DB
```

The media plane stays where telephony latency, carrier access, or data residency requires. Cross-product integration uses outbound HTTPS and tolerates temporary disconnection. A booking must never fail merely because a Voice edge is offline; a live Voice call must degrade to callback/human handoff if Booking is unreachable.

## Source-of-truth boundaries

| Domain | System of record |
|---|---|
| Identity account and MFA | Shared Identity |
| Product subscriptions and entitlements | Suite Control Plane |
| Tenant membership/roles | Each consuming application |
| Customer, subject, service, resource, booking, package, fulfillment | Booking |
| Phone number, extension, queue, call, recording, transcript, AI turns, QoS | Voice |
| Cross-product activity index | Projection built from both event streams |
| Billing usage | Originating product emits; Control Plane aggregates |

There must be one writable owner for every important concept.

## Customer identity and linking

Do not merge the Voice `Contact` table and Booking `Customer` table through shared storage.

In combined mode:

- Booking Customer is canonical for customer identity and profile.
- Voice Contact becomes a call-optimized projection/cache containing caller display data and a `booking_customer_id` external reference.
- Phone normalization should use E.164 plus verified contact-point records in Booking. The Voice platform's trailing-nine-digit Kenyan match may remain a local lookup optimization, but it must not silently merge two Booking customers.
- An incoming number with multiple possible customers produces an ambiguous match for the agent/AI to resolve.
- New callers may remain unresolved Voice contacts until a booking/customer is deliberately created.
- Customer merge and split operations in Booking emit events so Voice repairs its projection.

Create a generic mapping table in both products:

```text
ExternalReference
  local_entity_type
  local_entity_id
  external_system
  external_entity_type
  external_entity_id
  platform_org_id
  verified_at
```

This prevents product-specific foreign-key columns from multiplying through every table.

## Integration contract

### Booking APIs used by Voice

```text
GET  /v1/customers:resolve?phone=...
GET  /v1/customers/{id}/context
GET  /v1/customers/{id}/upcoming-bookings
POST /v1/availability/search
POST /v1/booking-holds
POST /v1/bookings
POST /v1/bookings/{id}/reschedule-offers
POST /v1/bookings/{id}/reschedule
POST /v1/bookings/{id}/cancel
GET  /v1/bookings/{id}
```

Availability returns offers, not raw times:

```json
{
  "offer_id": "...",
  "starts_at": "...",
  "ends_at": "...",
  "display_label": "Thursday at 10:00 AM",
  "expires_at": "...",
  "explanation": ["manual instructor available", "manual vehicle available"],
  "confirmation_requirements": ["customer_confirmed"]
}
```

Voice speaks only labels and option identifiers returned by Booking. It does not reconstruct availability or resource logic locally.

### Voice APIs used by Booking

```text
POST /v1/calls                    # click-to-call or workflow call
GET  /v1/calls/{id}
GET  /v1/calls?customer_ref=...
GET  /v1/agents/presence
POST /v1/callbacks
POST /v1/voice-jobs               # premium outbound reminder/follow-up
GET  /v1/recordings/{id}/access   # permission-checked, short-lived access
```

Booking stores Voice references and summaries in its timeline. Recordings and transcripts remain in Voice; Booking receives permission-checked links or summarized projections, not copied media.

## Event envelope

Both products should publish a common versioned envelope:

```json
{
  "event_id": "01...",
  "event_type": "booking.confirmed.v1",
  "occurred_at": "2026-08-12T10:00:00Z",
  "platform_org_id": "...",
  "producer": "booking",
  "subject": {"type": "booking", "id": "..."},
  "actor": {"type": "user|service|customer", "id": "..."},
  "correlation_id": "...",
  "causation_id": "...",
  "schema_version": 1,
  "payload": {}
}
```

Initial event families:

```text
booking.requested / held / confirmed / rescheduled / cancelled
booking.checked_in / started / completed / no_show
customer.created / updated / merged
package.purchased / credit_consumed / credit_released
resource.unavailable
call.started / answered / ended / missed
call.ai_intent_detected / transferred
call.booking_suggested / booking_completed
voice.callback_created / completed
```

Delivery requirements:

- transactional outbox in the product that changes state;
- at-least-once delivery;
- signed requests or short-lived machine tokens;
- idempotent consumers keyed by `event_id`;
- retry with backoff and dead-letter visibility;
- schema versioning and compatibility tests;
- replay support for rebuilding projections;
- correlation IDs spanning call, booking hold, booking, and workflow.

Voice's current webhook delivery is a useful UX/API foundation, but suite-critical events should move from daemon threads to a durable outbox worker.

## Machine-to-machine security

- Do not reuse a human OIDC token or tenant API key between products.
- Prefer short-lived service credentials issued for a registered product instance.
- Scope permissions narrowly: `booking.availability.read`, `booking.create`, `voice.call.create`, and so on.
- Bind every credential to `platform_org_id` or an explicitly authorized tenant set.
- Rotate and revoke credentials independently.
- Sign webhook bodies and include timestamp/replay protection.
- Require idempotency keys for all externally triggered mutations.
- Audit support elevation and every cross-product write.

A transitional deployment may use the Voice platform's existing scoped API-key machinery, but the destination should be revocable machine identity—not permanent shared secrets copied into several apps.

## Voice AI booking behavior

The existing Voice doctrine is exactly right: the AI may understand intent and present choices, but Booking determines truth.

```text
Caller intent
  -> Voice resolves organization and probable customer
  -> Voice calls Booking availability API
  -> Booking expands requirements and returns 2–3 concrete offers
  -> Voice asks caller to choose an enumerated option
  -> Voice repeats the exact service/time/location and asks for confirmation
  -> Voice confirms the hold through an idempotent Booking command
  -> Booking returns committed booking ID and customer-facing confirmation
  -> Voice records booking ID on the call and speaks success only after commit
```

Failure behavior:

- Booking unavailable: collect preference and create a reviewable booking request/callback; never invent a slot.
- Offer expired: apologize briefly and refresh offers.
- Commit conflict: return new offers.
- Customer ambiguous: ask a bounded identifying question or hand off.
- Missing eligibility/payment/form: explain the required next action returned by Booking.
- Low-confidence intent: create an `AppointmentSuggestion`, not a booking.

## Unified experience without merging applications

For customers entitled to both products:

- one sign-in;
- one organization switcher based on the same `platform_org_id`;
- a product launcher: **Operations**, **Voice**, **Customers**, **Analytics**, **Admin**;
- consistent design tokens, typography, iconography, and account controls;
- deep links between linked records;
- contextual actions, e.g. “Call customer” in Booking and “Open booking” in Voice;
- one customer activity view built from event projections;
- clear source badges: Booking, Phone call, SMS, Payment, Workflow.

Do not iframe one application inside the other. Keep separate deployments and route boundaries, with shared SSO and a consistent shell contract. A future shell package may share tokens and navigation primitives, but do not force the existing Vite Voice frontend and the new Booking frontend into one repository before the integration contract is proven.

## Premium combined-product capabilities

These justify a materially higher price than the sum of two basic tools:

### AI receptionist that can truly transact

- recognizes an existing customer;
- understands package balance and eligibility;
- offers valid multi-resource slots;
- books, reschedules, or cancels with confirmation;
- transfers with full context when necessary.

### Missed-call revenue recovery

- detect a missed or abandoned call;
- identify whether the caller attempted to book;
- create a prioritized recovery task;
- send a booking link or initiate an outbound call;
- measure recovered bookings and revenue.

### Unified customer memory

- calls, bookings, messages, payments, forms, outcomes, and follow-ups in one chronological projection;
- staff enter any interaction already informed;
- permissions determine whether recordings, transcripts, clinical notes, or financial data are visible.

### Service disruption recovery

- staff member becomes unavailable;
- Booking computes feasible rearrangements;
- Voice calls or messages affected customers;
- operator approves the plan;
- every change is deterministic and audited.

### Revenue and operations intelligence

- call-to-book conversion;
- missed-demand and capacity-gap analysis;
- booking intent by call topic;
- no-show risk and reminder effectiveness;
- agent/AI containment versus downstream booking outcome;
- packages with unused credits and low recent engagement.

## Migration strategy for Voice Phase S

Use a strangler pattern rather than deleting working code.

### Step 1 — Introduce a provider interface in Voice

```text
BookingProvider
  resolve_customer(...)
  search_offers(...)
  hold_offer(...)
  confirm_booking(...)
  reschedule(...)
  cancel(...)
  get_booking(...)
```

Implementations:

- `LocalAppointmentProvider` wraps the existing Phase S models for Voice-only legacy tenants.
- `RemoteBookingProvider` calls the Booking API for combined tenants.

Provider selection is organization configuration/entitlement, never a code fork.

### Step 2 — Make combined mode single-write

Once an organization is linked to Booking:

- Booking becomes the only writable booking source.
- Voice's local appointment UI is hidden or becomes a read-only projection.
- Voice AI tools call `RemoteBookingProvider`.
- Booking events populate Voice display projections and call links.

Do not dual-write both appointment databases. Distributed dual writes fail in precisely the cases customers care about most.

### Step 3 — Migrate existing Voice appointments

- export services, resources, schedules, contacts, appointments, reminders, and public links;
- transform them into Booking entities;
- retain `voice_legacy_id` external references;
- run count, time-range, status, and overlap reconciliation reports;
- freeze local writes during cutover;
- replay missed Voice events;
- keep the local dataset read-only through a rollback window;
- switch the organization entitlement to remote provider only after verification.

### Step 4 — Decide the future of Voice-only appointments

After real sales evidence:

- either keep the local provider as a deliberately limited “Voice Scheduler Lite”; or
- make Booking Core an included dependency of every new Voice sale while still presenting Voice as the purchased product.

Do not decide this solely from architecture. Decide from packaging, support cost, and whether Voice-only buyers repeatedly use appointment features.

## Delivery roadmap

### Phase 0 — Suite decisions and ADRs

Produce and approve:

- product/source-of-truth matrix;
- global organization and user identity rules;
- entitlement capability catalog;
- event envelope and compatibility policy;
- machine-authentication policy;
- customer-linking rules;
- Voice Phase S migration/legacy decision;
- deployment topology for hosted and edge Voice.

Exit gate: no important entity has two proposed writable owners.

### Phase 1 — Shared identity and tenant registry

- register Voice and Booking as separate OIDC clients;
- add `identity_subject` and `platform_org_id` mappings;
- implement dual-login migration for Voice;
- implement local membership admission in both products;
- create the control-plane entitlement API;
- add product launcher and organization switching contract;
- test revocation and cross-tenant denial.

Exit gate: one person can enter an entitled Booking tenant and Voice tenant with one identity, while a valid identity without local membership is denied.

### Phase 2 — Versioned integration foundation

- publish OpenAPI contracts;
- implement scoped service credentials;
- add transactional outboxes and idempotent inboxes;
- define contract tests and local fake servers;
- propagate correlation IDs;
- add delivery/dead-letter operations UI.

Exit gate: a booking event and a call event survive receiver downtime and replay exactly once at the business-effect level.

### Phase 3 — Booking kernel and Driving School product

- implement multi-resource requirements and allocations;
- port proven time/hold/concurrency behavior from Voice;
- build Booking customers/subjects, branches, services, resources, capabilities, packages, and fulfillment;
- ship Driving School Industry Pack and public booking;
- prove Dental and Salon scenario fixtures.

Exit gate: the scheduler atomically confirms student + instructor + compatible vehicle, and cannot produce invalid overlaps under concurrency.

### Phase 4 — Voice-to-Booking connector

- build `BookingProvider` interface in Voice;
- implement remote customer resolution and context screen-pop;
- integrate availability, hold, confirmation, reschedule, and cancellation tools;
- attach Booking IDs to calls and Call IDs to bookings;
- connect transcript suggestions to Booking review queues;
- implement deterministic fallback behavior.

Exit gate: a real inbound call books a valid Driving School lesson against Booking, the booking appears in the Booking calendar, and both products show the linked interaction.

### Phase 5 — Unified customer timeline and operator workflows

- build cross-product activity projection;
- add deep links and contextual actions;
- implement missed-call recovery;
- add one-channel reminders/follow-up through the correct owning product;
- implement combined analytics.

Exit gate: an operator can trace call -> booking -> reminder -> fulfillment outcome without manually searching either product.

### Phase 6 — Premium orchestration

- disruption simulations and approval plans;
- outbound voice reminders and recovery calls;
- cross-product workflow triggers/actions;
- optimization and operational copilot;
- enterprise controls and usage billing.

Exit gate: intelligence proposes an explainable plan, a human approves it, deterministic product APIs execute it, and the audit trail connects every consequence.

## First 30-day execution plan

### Week 1

- Approve the source-of-truth and packaging decisions in this document.
- Write ADRs for identity, tenant IDs, entitlements, events, and booking ownership.
- Define `platform_org_id`, `identity_subject`, and external-reference schemas.
- Inventory every Voice appointment API/UI/tool call that the provider interface must cover.

### Week 2

- Draft Booking and Voice OpenAPI contracts.
- Define event schemas and idempotency rules.
- Build contract-test fixtures from the existing Voice Phase S scenarios.
- Create a suite-level architecture test matrix: Booking-only, Voice-only, combined, disconnected Voice edge, revoked entitlement, wrong tenant.

### Week 3

- Prototype OIDC login in a non-production Voice environment without removing JWT login.
- Create the local identity-subject and global-organization mappings.
- Prototype the entitlement response and capability resolution.
- Implement a fake `RemoteBookingProvider` in Voice against a contract stub.

### Week 4

- Run one vertical walking skeleton:
  - caller identified;
  - availability requested from a stub/new Booking API;
  - concrete offers presented;
  - confirmation command sent idempotently;
  - booking and call IDs linked;
  - events shown in a minimal shared timeline.
- Review failures before expanding the Booking UI or scheduler.

## Decisions to make together

1. Should Voice-only remain a first-class sellable product, or is Voice always sold with a minimal Booking Core entitlement?
2. Will Booking initially be shared SaaS, per-client deployment, or support both?
3. Which domain/name will host the suite launcher and shared identity?
4. Is the initial premium customer still Driving School, or does the existing Voice customer base suggest another beachhead?
5. Which product owns customer communications when both are installed: Booking policy with Voice as a channel, or separate channel-specific policy?
6. Must a combined installation keep working when the Voice edge loses internet access to Booking, and for how long?
7. Are recordings/transcripts allowed to leave the Voice deployment as text summaries, links, or neither?
8. Is billing centralized now, or should the control plane initially expose entitlements configured manually?
9. Do current Voice customers already have Phase S appointment data that must be migrated?
10. Which unified metric is commercially strongest: recovered missed calls, call-to-book conversion, reduced no-shows, or resource utilization?

## Recommendation

The recommended first premium story is:

> “Your AI receptionist does not merely answer calls. It knows the customer, sees real service capacity, books the right people and resources, recovers missed demand, and connects every conversation to the service outcome.”

That promise is differentiated, measurable, and technically aligned with what already exists. It also gives the suite a path from two products to a genuine Service Operations OS without collapsing them into an unmaintainable monolith.
