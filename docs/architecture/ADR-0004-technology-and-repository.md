---
id: ADR-0004
title: TypeScript Modular Monolith and Workspace
status: accepted
date: 2026-08-12
requirements: [REQ-FOUNDATION-001]
tests: [TEST-FOUNDATION-001]
risks: [RISK-STACK-COUPLING-001]
---

# Decision

Booking begins as a pnpm workspace on the Node 24 LTS line with strict TypeScript.

- Next.js provides the initial staff and public web routes.
- Fastify provides the domain HTTP API and canonical OpenAPI description.
- A separate worker composition root processes outbox, expiry, notification, and reconciliation work.
- The `pg` driver plus small typed repository adapters provides the current query boundary; reviewed SQL migrations own PostgreSQL-specific constraints. Kysely is intentionally deferred until query complexity or measured maintenance cost justifies a repository-wide migration.
- Domain, scheduling, contracts, pack, design, authentication, database, and observability packages remain independently testable.

Framework imports do not enter the deterministic domain or scheduling packages. Clients consume generated/versioned contracts rather than importing API implementation types.

# Acceptance

- One lockfile and root verification command cover every workspace.
- Dependency-boundary tests prevent domain-to-framework imports.
- Strict typecheck, lint, tests, and production builds pass.
- Authored source files remain approximately 300 lines or fewer.

# Consequences

Booking does not reuse Voice's Django models. Proven Voice behavior is reused through characterization tests, algorithms, and integration contracts.
