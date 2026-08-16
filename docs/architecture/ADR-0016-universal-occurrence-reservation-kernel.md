# ADR-0016 — Universal Occurrence and Reservation Kernel

## Status

Accepted for BATCH-001 implementation.

## Decision

The platform models a dated service delivery as a `ServiceOccurrence`, and a customer's or group's claim on that occurrence as a `Reservation`. The existing `Booking` appointment model remains a compatible legacy composition while persistence migrates at a deliberate contract boundary.

An occurrence owns service identity, time, lifecycle, and capacity. A reservation owns customer identity, quantity, and reservation lifecycle. Resource allocations remain a separate constraint because a reservation can require several simultaneous resources, while a shared class or transport trip can reserve capacity without exclusive resources.

The common path is:

`service definition -> occurrence -> reservation -> participant/quantity -> resource allocations`

Dental and driving appointments use capacity one plus exclusive resources. Fitness uses shared capacity. Transport uses route-backed occurrences and passenger quantity. Charter uses unlimited or whole-vehicle capacity plus exclusive vehicle/crew resources.

## Invariants

- Every occurrence and reservation is tenant-scoped.
- An occurrence accepts reservations only in `published` or `open` state.
- `reservedQuantity` counts `held`, `confirmed`, and `checked_in` reservations; completed, cancelled, and no-show records remain historical but release capacity.
- Capacity is nullable for unlimited or separately constrained journeys.
- Database transactions, unique keys, exclusion/capacity constraints, and idempotency remain the final concurrency authority.
- Packs supply labels, requirements, policies, and workflow composition; they do not fork these primitives.

## Consequences

This gives every industry one scheduling kernel while preserving the existing appointment API during migration. The next packet adds additive persistence and concurrent reservation proof before any pack-specific UI is built.
