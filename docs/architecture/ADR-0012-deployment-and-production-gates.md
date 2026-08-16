---
id: ADR-0012
title: Portable Deployment and Production Data Gates
status: proposed
date: 2026-08-12
requirements: [REQ-OPS-001]
tests: [TEST-OPS-001]
risks: [RISK-REGULATORY-001, RISK-RECOVERY-001]
---

# Decision

Package the web, API, and worker as reproducible containers. Use managed PostgreSQL, object storage for documents/exports, HTTPS, secret management, structured telemetry, automated backups, and tested restoration. Services remain stateless outside declared stores.

Cloud provider and production region remain deployment configuration until the first launch country, data categories, recovery objectives, and budget are accepted. No real customer or health-adjacent data enters production before that review.

Walking-skeleton development uses local containers and synthetic test fixtures clearly marked as test data.

# Acceptance

- Local and CI environments start reproducibly.
- Configuration contains no committed secrets.
- Migration, backup, restore, rollback, health, and observability drills pass before pilot.
- A launch readiness review records privacy, retention, deletion, incident, and regional decisions.

