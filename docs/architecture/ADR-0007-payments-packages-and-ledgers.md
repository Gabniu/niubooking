---
id: ADR-0007
title: Provider-Neutral Payments and Internal Entitlement Ledgers
status: proposed
date: 2026-08-12
requirements: [REQ-COMMERCE-001]
tests: [TEST-COMMERCE-001]
risks: [RISK-PAYMENT-DIVERGENCE-001]
---

# Decision

Booking models provider-neutral payment intents, attempts, refunds, and reconciled webhook evidence. Provider adapters translate M-Pesa, card, or future provider protocols without changing booking state semantics.

Package credits and memberships use an append-only internal entitlement ledger. A provider payment status is not the credit balance. Consumption, release, expiry, refund, and correction entries are idempotent and auditable.

Deposits are optional service policy. V1 excludes insurance and clinical billing. No live payment provider is required for the walking skeleton.

# Acceptance

- Duplicate/out-of-order webhooks produce one material effect.
- Booking confirmation and credit consumption obey the configured atomicity policy.
- Refund and cancellation compensation preserve history.
- Provider outage has an explicit pending/reconciliation state.

