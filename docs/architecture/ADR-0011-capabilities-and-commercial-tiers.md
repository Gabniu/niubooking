---
id: ADR-0011
title: Capability Entitlements and Commercial Tiers
status: proposed
date: 2026-08-12
requirements: [REQ-ENTITLEMENT-001]
tests: [TEST-ENTITLEMENT-001]
risks: [RISK-PLAN-COUPLING-001]
---

# Decision

Commercial plans resolve to versioned capability entitlements and configurable limits. Domain and UI code query capabilities, never plan names, prices, or marketing labels.

Initial offers are Booking Essentials, Booking Operations, Voice, and Premium Suite. Essentials provides a complete booking-only lifecycle with lower configurable limits. Operations adds multi-branch depth, packages, forms, fulfillment, outcomes, automation, and analytics. Premium adds integration capabilities to Booking Operations plus Voice.

Industry Packs may be included or separately entitled. Downgrade disables capabilities without deleting canonical customer or booking history.

# Acceptance

- Booking-only organizations never require Voice infrastructure.
- Capability changes take effect without redeployment.
- Upgrade preserves identifiers and activates premium integration safely.
- Downgrade has explicit read/export/retention behavior and no silent data loss.

