# Test Catalog

Current repository verification (2026-08-19): Booking is running on
`vp-server` in an isolated API/web/database stack. All 34 migrations apply,
both health probes returned 200, the web shell served successfully, `/auth/session`
returned an unauthenticated response, and `/auth/login` returned the NOVA Auth
redirect with the exact callback and S256 PKCE. The stack is bound to localhost
ports 3110/3111 behind the HTTPS nginx vhost; its environment file is outside
the source bundle.

Fast-lane update: the compiled suite now contains 406 tests (403 passing and 3 intentionally skipped locally); the three real-PostgreSQL tests pass in CI, while the local lane skips them when `TEST_DATABASE_URL` is absent.

Test IDs connect product intent to automated evidence. The repository currently has 296 compiled Node tests and 20 passing browser journeys; this catalog adds the real-database layer and reserves acceptance suites for future batches.

Approved-server evidence (2026-08-14): `vp-server` PostgreSQL, isolated temporary schema, Node 24 runner — migrations reran successfully, competing reservations did not oversell, and concurrent cancellation released capacity exactly once. Temporary server workspace and test container were removed after the run.

Approved-server staging evidence (2026-08-15): current-source temporary API and web images built on `vp-server` with Node 24; the three PostgreSQL integration tests passed serially (including migration 029), the API image applied all 29 migrations against an isolated PostgreSQL container, returned 200 for both `/health/live` and database-backed `/health/ready`, and returned the expected generic 503 for `/auth/login` and `/auth/session` when OIDC configuration was absent; the production startup gate rejected missing OIDC configuration, and the web image served its shell. Temporary containers, image tags, networks, and workspace were removed after the smoke test.

## Assurance layers

| Test ID | Invariant | Layer | Executable evidence | State |
|---|---|---|---|---|
| TEST-OPS-001 | A batch cannot close with oversized source, malformed traceability, broken migrations, lint/type errors, failing unit tests, or a broken guest shell | Batch gate | `npm run verify:batch` | active |
| TEST-OPS-002 | Reservation lifecycle mutations append tenant-scoped, scalar-only audit evidence in the same transaction | Domain and persistence | `audit.test.ts`, `audit-events.test.ts`, `occurrences.test.ts`; migration `022_audit_events.sql` | active |
| TEST-DB-001 | All immutable migrations apply to real PostgreSQL and rerun without duplication | Integration | `migrations.integration.test.ts`; approved-server lane passed; requires explicit `TEST_DATABASE_URL` (CI may use ephemeral compose) | active |
| TEST-WEB-001 | The disconnected staff shell is honest, navigable, error-free, and compact-width usable | Browser journey | `workspace-shell.spec.mjs` | active |
| TEST-AUTH-001 | Identity admission fails closed and tenant membership cannot cross boundaries | Contract and integration | `auth-routes.test.ts`, `oidc-client.test.ts`, `authenticated-context.test.ts`, local-user mapping tests; live provider callback pending | partial |
| TEST-CORE-002 | Customer identity stays tenant-scoped through lifecycle changes | Contract and persistence | Existing customer tests | partial |
| TEST-CORE-003 | Services expand only valid policy and requirement definitions | Domain and integration | `services.test.ts`, `service-variants.test.ts`, `service-routes.test.ts`, `services-client.test.ts`, `service-composition-client.test.ts`, migrations `023_service_definitions.sql`, `024_service_variants_requirements.sql` | partial |
| TEST-CORE-004 | Resource lifecycle and allocation remain tenant-safe and conflict-safe | Domain, persistence, journey | Existing resource tests; browser journey pending | partial |
| TEST-SCH-010 | Materialized requirement slots match typed capabilities, preserve assignment identity, and revalidate holds without reusing resources | Domain, API, client, persistence, public QR journey | `requirement-availability.test.ts`, `industry-packs.test.ts`, `requirement-availability-routes.test.ts`, `requirement-availability-client.test.ts`, `guest-booking-client.test.ts`, `booking-public.test.ts` | active |
| TEST-SCH-001 | Every occurrence has valid time, service, capacity, and lifecycle semantics | Domain and database | `packages/domain/src/occurrence.test.ts`; `migrations.integration.test.ts` approved-server run | active |
| TEST-SCH-002 | Reservation quantity never exceeds occurrence capacity, participants retain identity, and concurrent lifecycle release cannot drift inventory | Domain and database concurrency | `packages/domain/src/occurrence.test.ts`; `occurrences.concurrency.integration.test.ts` approved-server run | active |
| TEST-SCH-003 | Holds expire and concurrent confirmation cannot double-book a customer or resource | Persistence | Existing hold/allocation tests; live concurrency pending | partial |
| TEST-SCH-004 | Changes are authorized, policy-compliant, idempotent, and suppress stale messages | Cross-service integration | Existing manage and worker tests | partial |
| TEST-SCH-005 | Public QR discovery resolves only active destinations and publishable occurrences without leaking tenant internals | API and browser journey | `occurrence-routes.test.ts`; guest booking client and missing-code browser journey | partial |
| TEST-SCH-006 | Public occurrence reservations capture canonical identity, require explicit reminder consent, and are retry-safe without exposing customer identity | API, persistence, and browser journey | `occurrence-routes.test.ts`, `occurrences.test.ts`, `guest-booking-client.test.ts`, `workspace-shell.spec.mjs`; migration `020_public_reservation_idempotency.sql` | partial |
| TEST-SCH-007 | A committed occurrence reservation produces only policy-approved, idempotent reminder work with reservation/occurrence subjects | Cross-service integration | `communication-scheduling.test.ts`, `booking-communication-events.test.ts`, `public-occurrence-hooks.test.ts`, `public-occurrence-delivery.test.ts`; migration `021_communication_occurrence_subjects.sql` | partial |
| TEST-SCH-008 | Staff can list reservations and move them through valid lifecycle states while capacity is released or reclaimed atomically | Domain, API, persistence, staff client, and browser journey | `occurrence.test.ts`, `occurrence-routes.test.ts`, `occurrences.test.ts`, `occurrences-client.test.ts`, `workspace-shell.spec.mjs` | active |
| TEST-SCH-009 | Completed, cancelled, and no-show occurrence reservations cancel only their own pending reminder jobs after the status transaction commits | Cross-service integration | `booking-communication-events.test.ts`, `public-occurrence-hooks.test.ts`, `occurrences.test.ts` | active |
| TEST-QR-001 | Active destinations resolve tenant-safely and inactive/invalid codes fail safely | Contract and journey | `qr-client.test.ts`, `server.test.ts`, `qr-admin-client.test.ts`, `workspace-shell.spec.mjs` | active |
| TEST-QR-002 | Exports preserve selected style, physical sizing, quiet zone, and scanability | Render and scan | `qr-print-studio.test.ts`, `qr-svg.test.ts`, vendored browser encoder, `workspace-shell.spec.mjs` | active |
| TEST-COM-001 | Reminder timing, consent, quiet hours, retry, and change links follow organization policy | Cross-service integration | Existing communication tests; provider journey pending | partial |
| TEST-FBK-001 | Appointment and general audiences respect consent, caps, capabilities, and one-response rules | Cross-service integration | Existing feedback tests; delivery journey pending | partial |
| TEST-FBK-002 | Any creator-defined question count works in compact, stepped, and human conversational modes | Domain and browser journey | Existing presentation tests; extended journey pending | partial |
| TEST-PACK-001 | A validated pack changes composition without forking core invariants | Manifest, persistence, API, and browser journey | `industry-packs.test.ts`, `industry-pack-settings.test.ts`, `service-routes.test.ts`, `industry-packs-client.test.ts`, `industry-pack-settings-client.test.ts`, `workspace-shell.spec.mjs`; migrations `025_industry_pack_settings.sql`, `026_pack_materialization_metadata.sql`, `027_resource_capabilities.sql` | partial |
| TEST-PACK-002 | Dental and hospital fixtures allocate clinicians, rooms, chairs, and equipment correctly | Pack acceptance | Golden-fixture suite | planned |
| TEST-PACK-003 | Driving lessons allocate instructor and vehicle without conflict | Pack acceptance | Golden-fixture suite | planned |
| TEST-PACK-004 | Fitness classes enforce occurrence capacity rather than resource exclusivity alone | Pack acceptance | Golden-fixture suite | planned |
| TEST-PACK-005 | General-service fixtures prove configurable vocabulary and workflows | Pack acceptance | Golden-fixture suite | planned |
| TEST-TRN-001 | Route search produces dated trips with ordered stops, passenger reservations, immutable fare snapshots, valid boarding windows, safe public cancellation, a privacy-safe public ticket view, and reachable staff route/trip controls | Transport acceptance | `packages/domain/src/transport.test.ts`, `packages/database/src/transport.test.ts`, `apps/api/src/transport-routes.test.ts`, `apps/web/src/transport-public-client.test.ts`, `apps/web/src/transport-staff-client.test.ts`, `tests/e2e/transport-public.spec.mjs`, `tests/e2e/transport-staff.spec.mjs`, `tests/e2e/transport-ticket.spec.mjs`; PostgreSQL concurrency and loaded reservation journey pending | partial |
| TEST-TRN-002 | Concurrent seat/capacity sales never oversell and boarding is auditable | Database concurrency and journey | `packages/database/src/transport.test.ts`, `apps/api/src/transport-routes.test.ts`, `apps/web/src/transport-staff-client.test.ts`; trip and occurrence atomic admission/release plus idempotent boarding/audit unit proof present, real PostgreSQL concurrency and connected browser conductor journey pending | partial |
| TEST-TRN-003 | Charter reserves the whole vehicle and crew for the journey interval | Transport acceptance | Golden-fixture suite | planned |
| TEST-LIVE-001 | Authenticated telemetry is fresh, ordered, rate-bounded, and attached to the correct active trip | Realtime integration | Simulator and load suite | planned |
| TEST-LIVE-002 | Authorized customers see smooth movement, stale-state disclosure, and ETA uncertainty | Realtime browser journey | Simulator and browser suite | planned |
| TEST-VOICE-001 | Voice retries are idempotent and can book only server-validated availability | Provider contract | Consumer-driven contract suite | planned |
| TEST-VOICE-002 | Entitlements isolate standalone products while premium history joins safely | Suite integration | Cross-product acceptance suite | planned |

## Golden fixture matrix

Every kernel change must eventually run the same invariant suite against Dental, Hospital, Driving School, Fitness, Transport, and Charter fixtures. Pack-specific tests add behavior; they never replace the shared kernel suite.
