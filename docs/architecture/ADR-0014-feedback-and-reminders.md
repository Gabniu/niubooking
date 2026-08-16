---
id: ADR-0014
title: Configurable Feedback and Appointment Reminders
status: proposed
date: 2026-08-12
requirements: [REQ-COMMS-001, REQ-COMMS-002]
tests: [TEST-COMMS-001, TEST-COMMS-002]
risks: [RISK-COMMS-SPAM-001, RISK-COMMS-LINK-001]
---

# Decision

Booking models feedback and reminders as organization-configurable workflows. Feedback may be post-appointment, general-purpose for any eligible client, or campaign/event based. Reminders are relative to appointment time and include expiring manage-booking links subject to normal authorization and scheduling policies.

Organizations control enablement, templates, audience, channel, timing, timezone, quiet hours, frequency caps, language, expiry, opt-out behavior, and survey presentation. A template version has no platform-imposed question-count ceiling; its creator selects a compact scroll, guided steps with a questions-per-step pace, or a one-question conversational progression. Booking supplies safe recommended defaults and immutable template versions. Delivery providers, including Voice, deliver messages but do not own booking, feedback, response, or rescheduling truth.

# Consequences

The platform needs a consent-aware communication preference model, idempotent delivery attempts, versioned survey templates/responses, and signed or opaque single-purpose links. Feedback delivery jobs carry campaign/template metadata and issue one opaque capability per source job immediately before provider delivery; providers receive a public URL but cannot write Booking data. General feedback must not depend on a booking foreign key. Reminder scheduling belongs in the outbox/worker boundary, with cancellation and reschedule events invalidating stale work. Contact destinations are resolved late, after a job is claimed and policy suppression has passed; only the customer ID is persisted, and a missing destination completes the job as suppressed. The contact-method repository requires a tenant match, enabled method, explicit consent, successful verification, and no channel-specific opt-out before returning a destination. Verification challenges store only a salted hash, expire, consume on success, and stop accepting attempts after the configured limit; verification proves control of the destination but never silently grants communication consent. Verification codes are delivered through an immediate ephemeral `verification` provider payload rather than the outbox; a failed provider call revokes the challenge.

# Acceptance

- A no-booking client can receive and submit an enabled general feedback request.
- A completed appointment can receive an enabled post-appointment survey exactly once per configured capability.
- Reminder timing, timezone, quiet hours, opt-out, retry, and provider outcomes are observable.
- Manage-booking links cannot bypass tenant, identity, availability, payment, consent, or policy checks.
- Voice can deliver or collect feedback through versioned events without dual-writing Booking data.
