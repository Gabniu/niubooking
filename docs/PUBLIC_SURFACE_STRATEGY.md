# Public Surface Strategy

Status: implemented foundation; public manage-booking migration is complete, while guest booking discovery/confirmation remains in progress

The public `/` and staff `/app` entries now run through the Next.js App Router.
Legacy HTML routes are served by a temporary compatibility bridge while each
staff/customer route is migrated to real Next components and typed data states.

## Why the surfaces must be separate

Niu Booking serves three different audiences with different jobs:

1. A prospective organization deciding whether to buy the platform.
2. An organization member operating schedules, resources, customers, and communications.
3. A customer of that organization trying to book, manage, attend, or give feedback.

They should share the same design language, but they should not share the same navigation, density, or information architecture.

## Surface map

| Audience | Entry point | Primary job | Experience |
| --- | --- | --- | --- |
| Prospect | `/` | Understand the product and start a conversation | Marketing landing page |
| Existing client | `/login` or an app link | Authenticate and enter an organization | NOVA Auth flow |
| Organization staff | `/app` | Operate the business | Authenticated operations shell |
| Organization customer | `/book/:destination` or QR code | Discover availability and reserve | Tenant-branded public booking |
| Booking recipient | `/manage/:capability` | Reschedule, cancel, or view details | Focused manage-booking flow |
| Feedback recipient | `/feedback/:capability` | Answer a survey conversationally | Focused feedback flow |
| Transport passenger | `/trip/:destination` | Find a run, reserve capacity, and track it | Transport pack public flow |

## 1. Unauthenticated platform homepage

The root domain should not open on an empty staff dashboard. A visitor who is not signed in should see a calm product homepage:

- Navy platform header using Hanken Grotesk.
- Niu Booking mark and a clear `Sign in` action.
- Primary CTA: `See how it works` or `Start with Booking`.
- Short explanation that the platform adapts to appointments, classes, trips, and resources.
- Industry examples: healthcare, driving school, fitness, education, professional services, and transport.
- A visual explanation of the shared model: service occurrence, reservation, and resources.
- QR booking, reminders, rescheduling, feedback, and live transport tracking as capability highlights.
- Pricing/package entry points without inventing customer metrics.
- A secondary CTA for organizations that want Booking plus Voice operations.

The homepage should be sales-oriented, not an operations screen. A known client can still use a direct `/login` link or be redirected to login from protected `/app` routes.

## 2. What an organization client sees

After NOVA Auth, the client enters `/app` and sees the compact authenticated operations shell:

- Navy rail and compact Hanken typography.
- Organization and branch context in the header.
- Dashboard, schedule, customers, services, resources, occurrences, feedback, communications, QR Studio, and pack settings.
- Only real tenant data; no sample metrics.
- An explicit organization-selection or onboarding state when membership/context is missing.
- Industry-pack contributions inside the same shell, not a completely separate application.

The staff surface optimizes for repeated daily work: scanning, filtering, creating, changing, and resolving operational exceptions.

## 3. What an organization's customers see

The customer must not see the staff rail, internal IDs, tenant membership language, or technical errors. A public destination should open a focused booking experience:

- Full-width navy public header inspired by the supplied reference, using our Hanken Grotesk font.
- Organization logo/name and tenant-selected accent where configured.
- Contextual public navigation rather than staff navigation: `Book`, `Services`, `Locations`, `Contact`, and optionally `Track trip`.
- Currency/locale and language controls only when configured.
- A compact progress flow: choose service or trip, choose time/capacity, provide details, confirm.
- Clear availability explanations and plain-language conflict guidance.
- Confirmation with calendar link, manage/reschedule link, and configured reminders.
- Feedback invitation after completion, or a general feedback route when the organization enables it.

The reference header is therefore best treated as a public/customer pattern, not as the staff operations shell. Its categories must be supplied by the active industry pack; travel labels must not appear for a dental clinic.

## 4. Industry-specific public adaptations

The universal public shell stays stable while the active pack changes vocabulary and modules:

| Pack | Public customer flow | Optional public module |
| --- | --- | --- |
| Dental/medical | Service, practitioner, location, appointment | Preparation and privacy guidance |
| Driving school | Lesson type, instructor, vehicle, time | Learner progress and requirements |
| Fitness/education | Class, cohort, trainer, capacity | Waitlist and attendance details |
| Professional services | Consultation, advisor, time | Intake questions and document request |
| Transport | Route, run, seat/capacity, departure | Live vehicle position and arrival estimate |
| Charter | Vehicle journey, crew, whole-trip request | Quote/request workflow |

## 5. Transport public experience

Transport is not just another appointment. Its public destination should add:

- Route and departure/run selection.
- Capacity/seat state and reservation identity.
- Driver/vehicle presentation without exposing private staff data.
- A live map or moving vehicle marker when a trusted location feed is configured.
- Last-updated time, freshness state, and an honest unavailable/stale state.
- Arrival estimate that is explicitly an estimate, never a promise.

The operations shell can remain universal; the transport pack contributes route/run, vehicle, driver, reservation, tracking, and incident surfaces.

## 6. Theme direction from the supplied reference

Use the reference's navy public header and horizontal navigation as the public Booking visual language:

- Platform navy: `#0F2A43`.
- Deep interaction navy: `#081C2E`.
- Cool blue-gray canvas and borders.
- Hanken Grotesk for all text, including the wordmark.
- White or very light navigation text with a quiet active pill.
- One strong action per screen; avoid gradients and decorative travel imagery unless a tenant supplies it.

The authenticated operations shell can use the same navy foundation with denser rail navigation. The customer surface should be more spacious, guided, and task-focused.

## 7. Route and security rules

- `/` is public marketing and never loads tenant data.
- `/login` delegates to NOVA Auth.
- `/app/*` requires an opaque local session and active tenant membership.
- `/book/*`, `/trip/*`, `/manage/*`, and `/feedback/*` expose only publishable or capability-authorized data.
- Public pages never reveal internal customer IDs, staff membership, resource identifiers, or cross-tenant details.
- Every public flow has loading, unavailable, expired, permission, conflict, and retry states.

## 8. Build order

1. Preserve the current authenticated operations shell.
2. Split the root public homepage from `/app` and `/login`.
3. Create a reusable public booking header and focused booking layout.
4. Apply it first to the Next manage-booking flow, then appointment/QR booking.
5. Add pack-driven public vocabulary and modules.
6. Add transport run selection and live tracking as a separate capability batch.
7. Verify every surface at desktop, mobile, keyboard, empty, error, and stale-data states.

This keeps the public theme ambitious without making the staff dashboard or every industry behave like a travel website.
