---
id: ADR-0006
title: Scheduling Time, Horizon, Travel, and Concurrency
status: proposed
date: 2026-08-12
requirements: [REQ-SCHED-001, REQ-SCHED-002]
tests: [TEST-SCHED-001, TEST-SCHED-002]
risks: [RISK-OVERBOOK-001, RISK-TIMEZONE-001]
---

# Decision

Persist instants in UTC, preserve the interpreting IANA timezone, and model occupied intervals as half-open `[start, end)` ranges.

V1 uses weekly availability rules plus dated exceptions. Public search defaults to 90 days and staff search to 365 days, subject to tenant policy and a reviewed hard ceiling. Recurring booking series are deferred; packages create explicitly confirmed occurrences.

Travel is a typed `TravelTimePolicy`. Core ships fixed buffers. Driving School adds zone-matrix behavior. Live routing providers remain adapters and may not make confirmation nondeterministic.

All requirement allocations confirm in one transaction using stable lock order, exclusion/capacity constraints, deadlock retry, and idempotency. Partial allocation is forbidden.

# Acceptance

- DST gaps/folds, timezone changes, boundary adjacency, setup/cleanup, travel, and horizon tests pass.
- Separate database connections racing for the same allocation cannot both confirm.
- Reschedule preserves the original booking until replacement allocation commits.

