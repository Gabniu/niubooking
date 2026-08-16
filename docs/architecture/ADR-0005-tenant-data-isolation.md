---
id: ADR-0005
title: Shared-Schema Tenant Isolation
status: proposed
date: 2026-08-12
requirements: [REQ-TENANCY-001]
tests: [TEST-TENANCY-001]
risks: [RISK-CROSS-TENANT-001]
---

# Decision

Use one PostgreSQL database and shared schema initially. Every tenant-owned row carries `tenant_id`; tenant-owned foreign relationships include tenant identity so a row cannot reference another tenant accidentally.

Trusted server middleware resolves the active organization and branch from the authenticated local session. Database work executes in a transaction with trusted tenant context applied using `SET LOCAL`. PostgreSQL row-level security provides defense in depth for sensitive tables.

Request-body tenant identifiers, token organization claims, and URL identifiers never establish authorization. Global support access is a separate audited elevation path.

# Acceptance

- Cross-tenant read, write, join, external-reference, and inference tests fail closed.
- Connection-pool reuse cannot leak tenant context.
- Composite constraints prevent cross-tenant relationships.
- A valid identity without current membership is denied generically.

# Consequences

This is affordable for small tenants while preserving a future tenant-routing boundary for dedicated databases.

