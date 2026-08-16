# Voice ↔ Booking Contract V1 — Design Draft

## Authority

Booking is authoritative for availability and booking state. Voice is an authenticated client and event participant. Voice may never infer a slot from cached conversation state or write Booking persistence directly.

## Provider operations

```text
searchCustomers
listBranches
listServices
findAvailability
createHold
extendHold
releaseHold
confirmBooking
getBooking
rescheduleBooking
cancelBooking
attachCommunicationContext
```

Every mutating request carries:

- tenant-bound machine identity;
- correlation and causation identifiers;
- idempotency key;
- actor type and actor reference;
- origin call/conversation reference when applicable;
- contract version.

## Find-availability response

A returned option must be an opaque, expiring server-defined candidate containing enough signed/versioned context for Booking to revalidate it. Voice presents choices but does not reconstruct allocations.

The response distinguishes:

- no feasible availability;
- invalid request or unmet prerequisites;
- policy-restricted request;
- temporarily unavailable dependency;
- entitlement not enabled.

## Booking mutation semantics

- Confirmation always revalidates the hold and all requirements transactionally.
- Repeated commands with the same idempotency key return the original material result.
- Expired holds are explicit and recoverable by a new search.
- Partial multi-resource confirmation is forbidden.
- Reschedule retains the old booking until the replacement allocation commits.
- Audit evidence includes the Voice service principal and human/AI interaction context.

## Durable events

Booking publishes:

- `booking.held`
- `booking.confirmed`
- `booking.rescheduled`
- `booking.cancelled`
- `booking.completed`
- `booking.no_show_recorded`
- `customer.updated`
- `followup.requested`

Voice publishes:

- `call.started`
- `call.ended`
- `call.missed`
- `transcript.ready`
- `call.booking_linked`
- `voice.followup.completed`

Events use versioned envelopes, immutable event IDs, tenant identifiers, occurred/published timestamps, correlation/causation, data classification, and schema version. Consumers are idempotent.

## Failure and reconciliation

- Timeouts are treated as unknown outcome until queried by idempotency key.
- Retries use bounded exponential backoff and never invent a new idempotency key for the same command.
- Dead-letter handling has owner, alert, replay, and audit procedures.
- A reconciliation job compares linked Booking and Voice references without changing canonical state automatically.
- Provider migrations run per tenant and support rollback to the prior provider until parity is accepted.

