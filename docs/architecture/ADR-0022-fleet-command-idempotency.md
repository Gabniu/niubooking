# ADR-0022 — Idempotent fleet tracking commands

Status: Accepted; implementation required before fleet tracking is production-verified  
Date: 2026-08-23  
Owners: Booking API, Database, and Driver client

## Context

Starting or handing over a tracking session creates two externally meaningful
effects: an active database session and a one-time provider credential. A lost
HTTP response followed by a retry currently creates a new request, and
handover can end the previous session before the caller receives the
replacement credential. The database active-session constraint prevents some
duplicates but cannot replay the original response.

This is a user-flow failure for `STORY-DRIVER-01` / `FLOW-DRIVER-01`: a driver
must be able to recover from a weak connection without ending up with an
unknown sharing state or a credential that no longer matches the active
session.

## Decision

Treat start and handover as idempotent commands with a caller-supplied command
key. The implementation must:

1. Require a bounded idempotency key for each start/handover command and scope
   it by tenant and operation.
2. Persist the request fingerprint and resulting session identifier in the
   same tenant transaction as the session mutation, with a database uniqueness
   constraint on `(tenant_id, operation, idempotency_key)`.
3. Return the original session and provider credential on a matching replay;
   reject reuse of a key with a different request fingerprint.
4. Make credential replay possible through server-side derivation or
   authenticated encryption. Never store a raw provider credential in the
   database, logs, browser storage, fixtures, or audit metadata.
5. Claim a handover command before ending the previous session. A concurrent
   replay must resolve to the first command result, not race into a second
   handover.
6. Persist a pending command key at the Driver client boundary until the server
   result is durably stored. A network failure must offer “Try again” using
   the same key; a deliberate new start uses a new key.

## Acceptance

- Same start key + same payload returns the same session and credential without
  a second audit mutation.
- Same handover key + same payload returns the same replacement session and
  leaves the original handover outcome intact.
- Same key + changed trip, device, driver, duration, or previous session is a
  clear conflict and does not mutate state.
- Two concurrent requests with the same key produce one session, one provider
  credential, and one start/handover audit event.
- A lost response can be retried after process restart and still recover the
  original result.
- Tenant isolation, authorization, migration forward/backward checks, and
  real PostgreSQL concurrency tests pass.
- The Driver UI explains retry state in user language and never exposes a
  database identifier as the recovery mechanism.

## Consequences

The API, database adapter, native Driver client, and user-flow tests must ship
as one contract. A database-only change is incomplete because the client must
retain the pending key; a client-only retry is unsafe because concurrent
requests still need a database invariant.

