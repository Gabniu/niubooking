---
id: ADR-0008
title: Guest-First Public Booking Identity
status: proposed
date: 2026-08-12
requirements: [REQ-CUSTOMER-IAM-001]
tests: [TEST-CUSTOMER-IAM-001]
risks: [RISK-CUSTOMER-MERGE-001]
---

# Decision

Public booking is guest-first. A tenant may require verification of an email address or phone number before confirmation. Booking issues a narrow, expiring capability for managing that booking; it does not require a password account for the first transaction.

Customers may later authenticate through NOVA identity and claim eligible records using verified contact plus explicit conflict handling. Similar email, phone, or name values never cause a silent merge.

Management capabilities are booking-scoped, revocable, rate-limited, and stored hashed where applicable. They do not confer staff, tenant, or cross-booking access.

# Acceptance

- A guest completes booking without creating a password.
- Expired/revoked capabilities fail generically.
- Claim conflicts enter a reviewable state without data disclosure.
- Enumeration and cross-booking access tests fail closed.

