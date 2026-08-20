---
id: ADR-0020
title: Optional customer applications alongside public booking pages
status: accepted
date: 2026-08-20
requirements: [REQ-CUSTOMER-SURFACES-001]
tests: [TEST-CUST-001, TEST-CUST-002, TEST-CUST-003]
risks: [RISK-CUSTOMER-IDENTITY-LINKING-001, RISK-SURFACE-DUPLICATION-001]
---

# Optional customer applications alongside public booking pages

## Context

Different organizations need different customer entry points. A small client
may only need a QR code or link that opens a public booking page. A larger
organization may need customers to sign in, see history, repeat bookings,
manage preferences, receive updates, and use product-specific mobile features.
Transport riders additionally benefit from tickets, push updates, offline-safe
access, and scoped live vehicle tracking.

Forcing every customer to create an account or install an app would reduce
conversion and make affordable Booking plans less useful. Building separate
customer systems for every industry would duplicate identity, booking, consent,
and authorization logic.

## Decision

1. Public booking pages remain a permanent, guest-first surface. They support
   QR and link entry, contact verification where required, holds, confirmation,
   manage links, reminders, feedback, and transport ticket fallback without an
   app installation.
2. Build an optional authenticated customer web app/PWA over the same API and
   contracts. It supports linked customer records, upcoming/past work, repeat
   booking, preferences, feedback, and permitted cross-product history.
3. Add a specialized transport rider app only when native capabilities provide
   measurable value. It uses scoped customer/ticket sessions and never inherits
   staff permissions.
4. Keep one customer identity/linking policy and one canonical Booking truth.
   Guest records may be explicitly claimed or linked after verification; email
   or phone similarity alone never merges records.
5. Keep the current Next.js `apps/web` deployment during extraction. Introduce
   `apps/customer-web`, `apps/rider-mobile`, and product-specific shells only
   when release cadence, native requirements, or ownership justifies them.

## Target application map

```text
apps/
  web/              staff and public Next.js product shell (current)
  customer-web/     authenticated customer web/PWA (planned)
  rider-mobile/     transport customer app (planned)
  driver-mobile/    driver telemetry app (planned)
  api/              shared tenant-safe API
  worker/           shared reminders, feedback, outbox, and tracking jobs
```

These are deployable experiences, not separate domain authorities. Products
such as Niu Booking, Niu Care, and Niu Transport select composition, language,
navigation, and capabilities through product/pack configuration. Owner,
manager, admin, dispatcher, and staff remain roles or assignments inside the
appropriate product surface.

## Security and data rules

- Public capabilities are opaque, narrow, expiring, revocable, and action-specific.
- Customer sessions expose only explicitly linked records and permitted fields.
- Rider sessions are ticket/journey scoped and reveal privacy-safe projections.
- Staff sessions require NOVA Auth admission, local membership, branch scope, and entitlements.
- Customer and rider apps never receive provider secrets or staff tokens.
- Every surface has loading, unavailable, conflict, expired, denied, retry,
  offline, and stale-data behavior where applicable.

## Consequences

Positive:

- Affordable clients keep a frictionless booking path.
- Premium clients can offer a richer customer relationship without changing the
  booking kernel.
- Transport can adopt native tracking capabilities without forcing them onto
  dental, salon, or professional-service customers.
- Public pages, customer apps, staff workspaces, and Voice share contracts and
  event history rather than duplicated business rules.

Costs and risks:

- Each additional surface needs browser/mobile accessibility and journey tests.
- Account claim/linking and customer privacy require careful conflict handling.
- Product-specific apps can drift unless shared contracts, design tokens, and
  parity checks remain mandatory.

## Exit evidence

The decision is considered implemented when guest booking and authenticated
customer journeys pass tenant, identity-linking, consent, accessibility, and
responsive tests; the transport rider app is not required for the customer-app
decision until the live tracking capability reaches its own release gate.
