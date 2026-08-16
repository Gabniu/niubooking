---
id: ADR-0001
title: Booking, Voice, and Premium Suite Boundaries
status: proposed
date: 2026-08-12
requirements: [REQ-SUITE-001, REQ-SUITE-002]
tests: [TEST-SUITE-001, TEST-SUITE-002]
risks: [RISK-DUAL-WRITE-001]
---

# Decision

Booking and Voice are separately purchasable products connected through shared identity, entitlements, versioned APIs, and durable events.

Booking is authoritative for customers, booking subjects, services, resources, availability, bookings, packages, fulfillment, and outcomes.

Voice is authoritative for telephony, extensions, queues, calls, recordings, transcripts, AI turns, callbacks, and call quality.

Premium entitlements enable integrated capabilities without merging databases or repositories. A linked organization has one global `platform_org_id` mapped to a local tenant in each product.

Voice's current appointment implementation remains available through a `LocalVoiceBookingProvider` during migration. Organizations entitled to Booking use `RemoteBookingProvider`, and Booking becomes the only writable booking source. Dual writes are forbidden.

# Acceptance

- A Booking-only tenant operates without Voice infrastructure.
- A Voice-only tenant operates without Booking availability.
- A premium tenant can complete call-to-booking linkage through versioned contracts.
- Receiver downtime does not lose suite events.
- No combined-mode workflow writes the same booking independently to both stores.

# Consequences

- Products may have distinct visual identities and deployment topologies.
- Cross-product UI uses deep links and projections, not shared database reads or iframes.
- Commercial plans resolve into capabilities rather than plan-name conditionals.

