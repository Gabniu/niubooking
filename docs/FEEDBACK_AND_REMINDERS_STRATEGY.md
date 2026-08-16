# Feedback and Reminder Strategy

## Product role

Feedback and reminders are configurable communication capabilities available to Booking-only and Premium organizations. Booking owns the client, booking, consent, preference, and trigger context. A notification provider (including Voice for Premium) delivers messages; it does not become a second booking or feedback source of truth.

## Feedback model

Feedback is not restricted to clients who completed an appointment. Organizations may enable:

- post-appointment surveys triggered after a completed or attended booking;
- general client feedback requests sent to any eligible client, including clients with no booking history;
- event or campaign feedback tied to a branch, service, Industry Pack, QR source, or Voice-attributed interaction.

Each survey uses an organization-owned template with platform recommendations: a short rating, one improvement question, and an optional private follow-up request. Organizations can tune questions, language, rating scale, audience, channel, send window, frequency cap, expiry, and the client experience. A creator may publish an uncapped scrollable survey, guided steps with a chosen questions-per-step pace, or a human-feeling one-question-at-a-time conversation. Responses are versioned so changing a template never rewrites historical meaning.

Feedback links use opaque, expiring, single-purpose response capabilities. They reveal no internal IDs, allow one response per configured campaign/capability, support opt-out, and never grant staff access. Sensitive healthcare or safeguarding prompts require an explicit privacy review and must not be treated as emergency support.

## Reminder model

Organizations configure one or more reminders relative to the appointment, for example 72 hours and 2 hours before start, with channel, timezone, quiet hours, frequency cap, language, and cancellation/reschedule policy. Defaults are recommendations, not hidden behavior. A reminder includes a safe, expiring manage-booking link that can reschedule or cancel only after the normal identity, policy, availability, payment, and consent checks.

Reminders are suppressed or re-evaluated when a booking is cancelled, rescheduled, completed, opted out, outside quiet hours, or missing an eligible contact method. The worker resolves the current consented destination after claiming a job; the outbox stores only customer identity, never an email address or phone number. Sending is idempotent and recorded as an attempt with provider outcome, retry state, and audit context.

## Voice and Premium boundary

Booking emits versioned `feedback.requested`, `feedback.submitted`, `reminder.scheduled`, `reminder.sent`, and `reminder.failed` events. Voice may deliver a voice reminder or collect feedback for Premium, but Booking remains authoritative for eligibility, response storage, appointment changes, and attribution.

## Verification scenarios

1. A post-appointment survey sends only when its organization trigger is enabled.
2. A general feedback campaign can target an eligible client with no appointment history.
3. Organization templates and platform recommendations are distinguishable and versioned.
4. Frequency caps, opt-out, quiet hours, timezone, and missing-contact suppression work.
5. Reminder links expire, cannot cross tenants, and enforce normal reschedule/cancel rules.
6. Cancelled and rescheduled bookings do not receive stale reminders.
7. Retries and duplicate worker deliveries remain idempotent and auditable.
8. Voice attribution enriches events without becoming a second feedback or booking store.
