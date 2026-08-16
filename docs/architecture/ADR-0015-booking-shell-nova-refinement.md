---
id: ADR-0015
title: Compact NOVA Booking Shell Refinement
status: accepted
date: 2026-08-13
requirements: [REQ-UI-SHELL-001, REQ-UI-RESPONSIVE-001]
tests: [TEST-UI-SHELL-001]
risks: [RISK-UI-DATA-HONESTY-001, RISK-UI-MOBILE-NAV-001]
---

# Decision

Booking uses the compact NOVA operations shell as its universal product frame:
an approximately 208px NOVA deep-green rail (`#064E3B`), a matched 64px body
header, light workspace canvas (`#F7F9FD`), Hanken Grotesk typography, restrained Emerald actions, consistent
stroke icons, and quiet border-led cards. Mobile converts the rail into a visible
top bar while preserving the primary action and navigation context.

The supplied Stitch Adaptive Operations reference informs density, schedule
hierarchy, and utility placement, but its static appointments, people, metrics,
and specialty-specific language are not copied into production. Empty,
loading, permission, offline, and error states remain data-honest until the
Booking API supplies authorized workspace data.

# Consequences

The shell remains distinct from Voice while Industry Packs can contribute
navigation labels, contextual icons, accent colors, and typed widgets through
their registry. Future pages must use the project-local `docs/skills/booking-design`
skill and update the design system when a rule becomes universal.
