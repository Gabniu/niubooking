---
id: ADR-0003
title: Universal Booking Design and Industry Accents
status: proposed
date: 2026-08-12
requirements: [REQ-UX-001, REQ-PACK-001]
tests: [TEST-UX-001, TEST-PACK-001]
risks: [RISK-VERTICAL-HARDCODE-001]
---

# Decision

Booking uses a universal Obsidian/Emerald/Warm-Neutral product identity and Hanken Grotesk. Industry Packs contribute restrained secondary accents, terminology, navigation, dashboard composition, and typed contextual panels.

Primary actions remain Emerald across packs. Status colors retain stable meaning. Industry accents supplement but do not replace the core product identity.

Driving School is the first deep implementation. Dental and Salon must render from the same shell, components, scheduling primitives, and pack registries. A pack cannot require a separate application tree.

The frontend follows NOVA ADR-0036: 8px spacing rhythm, compact rail, restrained typography, minimum 48px touch controls, real data, explicit states, and desktop/tablet/mobile/keyboard/reduced-motion verification.

# Acceptance

- Removing the logo still leaves Driving School and Dental recognizably specialized.
- Switching packs does not switch application codebases.
- No universal component exposes Driving School terminology.
- Empty tenants display honest setup states rather than invented metrics.
- Responsive and accessibility gates pass for each foundational screen.

