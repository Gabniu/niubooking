---
id: ADR-0009
title: Voice Commands over OpenAPI and Events over Outbox Webhooks
status: proposed
date: 2026-08-12
requirements: [REQ-INTEGRATION-001]
tests: [TEST-INTEGRATION-001]
risks: [RISK-EVENT-LOSS-001, RISK-DUAL-WRITE-001]
---

# Decision

Voice uses authenticated versioned HTTP/OpenAPI operations for lookup, availability, holds, confirmation, reschedule, cancellation, and idempotency-result lookup.

Booking writes domain state and outbox events in one PostgreSQL transaction. A worker delivers signed, versioned webhook envelopes with bounded retry, dead-letter evidence, replay, and correlation/causation identifiers. Consumers maintain inbox deduplication.

No message broker is required initially. A future broker implements the same event-publisher port. Voice never reads or writes Booking's database.

# Acceptance

- Booking commit cannot succeed without corresponding outbox evidence.
- Duplicate, delayed, and out-of-order deliveries converge correctly.
- A timeout with unknown result is resolved using the original idempotency key.
- Provider migration and rollback operate per tenant without dual writes.

