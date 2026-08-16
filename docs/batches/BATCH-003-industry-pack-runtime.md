# BATCH-003 — Versioned Industry Pack Runtime

## Current state

The first pack-runtime contract is implemented without forking the universal booking kernel. `IndustryPackManifest` is schema-versioned and validates stable identifiers, semantic versions, theme colors, typed resources/capabilities, and service-template requirement references. Code-reviewed fixtures cover Driving School, Dental, Hospital, Fitness, Transport, Charter, and Salon; each fixture seeds a typed schedulable service or occurrence that flows through capability-aware advisory matching before atomic confirmation.

The read-only `/v1/industry-packs` catalog and compact `packs.html` surface expose the same registry safely, including code-reviewed pack navigation and dashboard contributions. Migrations `025_industry_pack_settings.sql` and `026_pack_materialization_metadata.sql` add tenant-selected pack/version, bounded terminology/theme overrides, append-only selection evidence, and source-version metadata for seeded catalog rows. Migrations `027_resource_capabilities.sql` and `028_requirement_assignments.sql` connect those typed slots to capability-aware resource matching and confirmation-time revalidation. `/v1/tenants/:tenantId/industry-pack` and `pack-settings.html` provide selection, audited overrides, and an idempotent materialization command. No tenant-controlled data can inject executable modules, routes, or component paths.

## Remaining work packets

1. Add lifecycle fixtures and connect tenant-selected pack contributions to the admitted workspace through the shared booking APIs (the read-only Next catalog and shell seam are now in place).
2. Add upgrade/downgrade migration proofs and approved-server persistence tests.
3. Add richer public assignment UX on top of the confirmed kernel path; the public flow now explains matched requirement labels while keeping resource IDs opaque.

## Acceptance gates

- [x] Manifest validation rejects invalid identifiers and unknown requirement references.
- [x] Driving School, Dental, Hospital, Fitness, Transport, Charter, and Salon fixtures validate with typed multi-resource requirements.
- [x] Registry rejects duplicate versions and resolves the latest version deterministically.
- [x] Pack catalog API and disconnected staff surface are covered by typed and browser tests.
- [x] Organization resolution and bounded overrides are persisted and audited.
- [x] Selection audit metadata classifies initial, upgrade, downgrade, same-version, and pack-change transitions without changing the stable event action contract.
- [x] Pack templates materialize idempotently into tenant service composition and produce explainable capability/resource candidate times.
- [x] Every registered fixture produces one feasible typed slot and rejects an incomplete resource assignment.
- [x] Pack-specific navigation and dashboard contributions are returned by the safe catalog contract and rendered in `packs.html`.
- [x] The Next staff shell exposes `/app/packs` from the same registry, with responsive pack cards and a clear handoff to authorized configuration.
- [x] Public holds persist typed requirement assignments and recheck every requirement under the PostgreSQL commit boundary.
- [x] Public advisory slots return human requirement labels separately from opaque resource IDs, and the booking page renders a plain-language assignment summary.
- [ ] Approved-server upgrade/downgrade and lifecycle proofs pass.
