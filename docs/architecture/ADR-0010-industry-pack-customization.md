---
id: ADR-0010
title: Versioned Industry Packs and Bounded Tenant Overrides
status: proposed
date: 2026-08-12
requirements: [REQ-PACK-001, REQ-PACK-002]
tests: [TEST-PACK-001, TEST-PACK-002]
risks: [RISK-PACK-FORK-001]
---

# Decision

Industry Packs are code-reviewed, versioned manifests plus registered typed modules. Tenant-controlled data cannot inject arbitrary executable code or component paths.

Resolution order is platform defaults, pack defaults, pack migration, organization overrides, branch overrides, then user display preferences. Overrides may specialize terminology, visibility, templates, workflow options, and presentation within schema limits. They cannot weaken tenant isolation, permissions, data classification, audit, or scheduling invariants.

Pack upgrades are explicit and migratable. Driving School is the first deep pack; Dental and Salon remain required fixtures for every schema evolution.

# Acceptance

- Invalid references and forbidden overrides fail validation.
- Three fixture packs render through one shell and execute through one booking API.
- Upgrade/downgrade compatibility and stored-data migrations are tested.
- Core packages contain no vertical terminology branches.

