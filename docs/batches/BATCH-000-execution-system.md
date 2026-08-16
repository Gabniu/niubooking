# BATCH-000 — Execution System

## Outcome

Turn the product plan into a faster, evidence-driven delivery system that can execute larger vertical batches without losing accepted capabilities or silently breaking existing industries.

## Capability IDs

`CAP-OPS-001`, with traceability coverage for every other ledger entry.

## Work packets

1. Stable capability and test ledgers plus an executable parity validator.
2. Immutable migration validation, checksum-protected runner, and real PostgreSQL proof.
3. Compact desktop/mobile browser smoke journeys.
4. Source-size, lint, type, unit, build, integration, journey, batch, and release commands.
5. CI enforcement and Graphify/Obsidian evidence refresh.

## Exit gates

- `npm run verify:batch` passes locally.
- Local verification never starts Docker implicitly; real PostgreSQL evidence uses an explicit `TEST_DATABASE_URL` from an approved test server. CI may provision an ephemeral database.
- `npm run verify:release` reports no high-severity dependency issue.
- CI runs the same commands rather than a weaker parallel definition.
- The current 296-test baseline remains green and database/browser proofs are added.
- No source file exceeds 300 lines.

## Residual work

The Batch 0 browser test is a foundation smoke journey, not full visual/accessibility certification. Each product batch must add its own journeys and golden industry fixtures.
