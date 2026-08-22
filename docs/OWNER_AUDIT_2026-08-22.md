# Project-owner audit — 2026-08-22

## Decision

The repository has a credible expert-level domain foundation, but the product is
not release-acceptable today. The public API is alive; the deployed web release
does not match the checked-in product. The public hostname serves the old static
operations shell at `/`, while the current Next pages and public link families
are absent from the live deployment. This is a P0 release blocker.

The correct owner decision is **do not accept the deployment as the Booking
product** until the current web image is deployed, every route below is checked
against the public hostname, and one real OIDC → tenant → data journey succeeds.

## Scope and method

This audit compared:

- `PROJECT_CONTEXT.md`, `MASTER_EXECUTION_PLAN.md`, product doctrine, ADRs,
  batch charters, the feature-surface matrix, public-surface strategy, and user
  flow audit;
- every checked-in Next page and auth/public route in `apps/web/app`;
- every legacy HTML page in `apps/web` and the production bridge;
- backend route contracts, persistence, authorization, telemetry, native runtime,
  tests, and the frontend/backend parity matrix;
- local source gates, unit tests, disconnected browser journeys, production
  build, mobile export, Graphify, and direct HTTPS probes to the deployed host.

The in-app browser connector had no available browser session. Local Playwright
still ran 64 desktop/mobile Chromium tests successfully, but neither that suite
nor source inspection substitutes for an authenticated production journey,
physical-device evidence, real PostgreSQL concurrency, or live visual review.

## Evidence summary

| Area | Evidence | Owner assessment |
|---|---|---|
| Domain and API foundation | 581 compiled tests: 577 pass, 4 PostgreSQL tests skipped; typed tenant/auth/booking/transport/GTFS/fleet contracts | Strong foundation; not production acceptance |
| Frontend route contract | 14 staff, 9 public, and 2 auth route families pass the repository route gate | Strong source contract; previously `/app/gtfs` was omitted from the gate and is now covered |
| Production build | `npm run build` passed; Next emitted the full staff, public, and auth route manifest | Build artifact is coherent locally; it is not yet the artifact serving the public hostname |
| Backend/frontend parity | 40 surfaces and 36 capabilities traceable | Good discipline; connected production proof remains missing |
| Local browser | 64 Playwright desktop/mobile journeys pass | Mostly disconnected/unavailable states; not loaded real-data journeys |
| Mobile | Typecheck, lint, and Expo web export pass | Native background capture, provisioning, and physical device proof remain open |
| Deployment | `/health/live` and `/health/ready` return 200 | API is reachable; web release is wrong |
| Database | Local integration lane skips without `TEST_DATABASE_URL` | CI/approved-server concurrency and migration evidence still required for release |
| Dependencies | `npm audit --audit-level=high`: 0 high, 0 critical, 11 moderate | No high-severity release stop; moderate Expo chain needs owned remediation |
| Graph | Graphify code-only refresh: 3,665 nodes, 5,921 edges; current clustering output 345 communities; previous Obsidian export: 4,011 notes | Architecture relationships refreshed; community count can vary between clustering runs; semantic doc extraction was unavailable without a configured graph LLM backend |

## User-story audit

| Story | Intended path | Source status | Release status |
|---|---|---|---|
| Prospect understands Booking and enters staff auth | `/` → `/auth/sign-in` → OIDC → `/app` | Next page and honest disconnected states exist | **Blocked:** live `/` is legacy; `/auth/sign-in` is 404 |
| Staff chooses a tenant and operates schedule | `/app` → workspace → `/app/schedule` | Tenant admission, typed clients, route pages, and safe states exist | **Blocked:** all staff Next pages are 404 live; real tenant journey untested |
| Staff manages customers/services/resources | `/app/customers`, `/app/services`, `/app/resources` | Real API client boundaries and pages exist | **Blocked in deployment; connected data journey pending** |
| Staff configures universal industry packs | `/app/packs` → `/app/pack-settings` | Pack catalog, bounded overrides, materialization, dental/salon/fitness/driving fixtures exist | **Blocked in deployment; golden acceptance fixtures still planned** |
| Staff creates a booking with resource truth | `/app/schedule` → availability → hold/confirm | Domain allocation and conflict boundaries are strong | **Partial:** source tests; real PostgreSQL/browser concurrency still required |
| Guest books through QR/link | `/book/[code]` | Opaque public destination, advisory availability, hold/confirm, consent, manage link exist | **Blocked:** live public family 404; provider delivery/release smoke pending |
| Guest reserves an occurrence | `/reserve/[code]` | Capacity, consent, retry/idempotency, public privacy boundaries exist | **Blocked:** live family 404; loaded journey pending |
| Guest changes/cancels | `/manage/[token]` | Capability and policy boundaries exist | **Blocked:** live family 404; loaded journey pending |
| Guest gives feedback | `/feedback/[capability]` | Versioned templates, caps, one-response and presentation modes exist | **Blocked:** live family 404; delivery journey pending |
| Guest verifies contact | `/verify-contact/[challenge]` | Hashed challenge, expiry, lock/recovery behavior exists | **Blocked:** live family 404; provider delivery pending |
| Transit staff publishes GTFS | `/app/gtfs` | Page, API, immutable artifacts, validation, alert lifecycle, cache/fallback contracts exist | **Blocked:** live page 404; worker/release evidence pending |
| Transit staff plans routes/trips | `/app/transport` | Typed staff/public contracts and privacy-safe ticket/live boundaries exist | **Blocked:** live page 404; connected conductor journey pending |
| Rider views ticket/live trip | `/ticket/[token]` → live viewer session → `/trip/[code]` | Scoped viewer sessions, stale/offline/ETA logic, privacy tests exist | **Blocked:** live pages 404; physical/public loaded journey pending |
| Driver starts and stops sharing | Native app → assigned trip → session → provider telemetry | Session credentials, queueing, fallback OsmAnd adapter, and server invariants exist | **Partial/P1:** visible app provisioning/start-stop is not composed; physical Android/iOS proof absent |
| Voice books through Booking truth | Voice integration boundary | Contract explicitly prevents Voice from inventing slots or writing Booking directly | **Deferred by design:** no issue if entitlement/provider acceptance stays separately owned |

## Complete deployed-page inventory

Checked directly against `https://booking.niuautomations.com` on 2026-08-22.
Expected behavior for a checked-in Next page is that the route resolves to its
Next page and can show its honest unavailable/unauthenticated state; a 404 means
the deployed release does not contain that page.

### Checked-in Next staff pages

| Page | Expected | Live result | Verdict |
|---|---:|---:|---|
| `/app` | Next workspace shell | 404 | **Missing** |
| `/app/communications` | Next communications page | 404 | **Missing** |
| `/app/customers` | Next customers page | 404 | **Missing** |
| `/app/feedback` | Next feedback page | 404 | **Missing** |
| `/app/gtfs` | Next transit publication page | 404 | **Missing** |
| `/app/occurrences` | Next occurrence page | 404 | **Missing** |
| `/app/pack-settings` | Next pack settings | 404 | **Missing** |
| `/app/packs` | Next pack catalog | 404 | **Missing** |
| `/app/qr-studio` | Next QR Studio | 404 | **Missing** |
| `/app/resources` | Next resources page | 404 | **Missing** |
| `/app/schedule` | Next schedule | 404 | **Missing** |
| `/app/service-composition` | Next composition page | 404 | **Missing** |
| `/app/services` | Next services page | 404 | **Missing** |
| `/app/transport` | Next transport operations | 404 | **Missing** |

### Checked-in Next public and auth pages

| Page | Expected | Live result | Verdict |
|---|---:|---:|---|
| `/` | Next public product homepage | 200 legacy HTML: `Booking — Operations workspace` | **Wrong release** |
| `/auth/sign-in` | Branded Next sign-in page | 404 JSON | **Missing** |
| `/book/example-code` | Next public booking unavailable state | 404 | **Missing** |
| `/feedback/example-capability` | Next feedback unavailable state | 404 | **Missing** |
| `/manage/example-token` | Next manage unavailable state | 404 | **Missing** |
| `/reserve/example-code` | Next occurrence unavailable state | 404 | **Missing** |
| `/ticket/example-token` | Next ticket unavailable state | 404 | **Missing** |
| `/trip/example-code` | Next trip unavailable state | 404 | **Missing** |
| `/verify-contact/example-challenge` | Next verification unavailable state | 404 | **Missing** |
| `/auth/login` | Auth handler | 302 | Handler reachable; live provider/config behavior not accepted |
| `/auth/callback` | Auth callback handler | 400 without callback parameters | Handler reachable; real OIDC callback not tested |

### Every legacy HTML page currently present

These are compatibility artifacts, not the intended target product. Their 200
responses demonstrate that the live server is serving the legacy release:

`/bookings.html`, `/communications.html`, `/contact-verification.html`,
`/customers.html`, `/design-preview.html`, `/feedback-admin.html`,
`/feedback.html`, `/guest-booking.html`, `/guest-manage.html`,
`/guest-occurrence.html`, `/index.html`, `/occurrences.html`,
`/pack-settings.html`, `/packs.html`, `/public-home-preview.html`,
`/qr-studio.html`, `/resources.html`, `/service-composition.html`, and
`/services.html` all returned 200 `text/html`.

`/app.html`, `/transport.html`, and `/ticket.html` returned 404. The latter two
are not present in the checked-in legacy page set and should not be used as
deployment evidence.

### Service probes

`/health/live` and `/health/ready` both returned 200 JSON. These prove API
reachability only; they do not prove that the web image, Next route manifest,
OIDC configuration, tenant database, worker, provider delivery, or native app
is the intended release.

### Deployment attempts after the audit

The current release candidate was packaged as immutable commit
`3c0291266663bc230595882f107f64a4e6230bd0` on
`release/audit-staging-2026-08-22` and pushed to GitHub. The first workflow run
(`32578136392`) stopped before deployment because the abbreviated SHA was
interpreted as a branch by checkout. The retry (`32578198091`) correctly
checked out the full SHA, then stopped at the deployment-secret gate because
all five `staging` environment secrets are currently absent. Neither run
opened SSH or changed the staging host. The release hold therefore remains
valid, but the source revision integrity problem is resolved; the remaining
blocker is staging access/configuration.

The deployment workflow was hardened afterward to bind archive and server
release paths to the exact checked-out SHA. Run `32596589911` verified
`eb343cd2c7fd49f99c95a013f17d8b323722c57d` and reported all five missing secret
names clearly, still without opening SSH or changing the host.

Follow-up owner verification on 2026-08-23 found the same production state:
API liveness/readiness are 200, but the 23-route Next smoke gate still fails;
the public web release remains the legacy shell. The release branch tip is the
revision to deploy once staging access is configured.

## Findings and improvements

### P0 — deployed web release is not the intended product

The live root is the old operations shell and all current Next pages/public
families are absent. The repository now contains a production bridge guard for
all nine migrated route families, but the deployed server has not consumed that
release. Fix by deploying the current web image and making live route smoke a
release gate, not an optional post-deploy check.

### P1 — source verification can go green while release is broken

`verify:batch` validates the repository and local web server, not the public
hostname. The repository now has `npm run check:deployed-web`, which checks the
exact route inventory above for real Next responses; it must be run against the
next deployed image together with a build identifier and authenticated staging
journey. Health-only acceptance remains prohibited.

### P1 — staging access is not configured

The GitHub Actions deployment client is available and the current audited tree
now exists as one pushed immutable release candidate. The staging environment is
missing `BOOKING_STAGING_HOST`, `BOOKING_STAGING_USER`,
`BOOKING_STAGING_SSH_KEY`, `BOOKING_STAGING_KNOWN_HOSTS`, and
`BOOKING_STAGING_APP_DIR`, so the workflow cannot reach the approved server.
Configure those values outside the repository, then run the workflow against
the full release SHA and keep the route gate as a hard acceptance check.

### P1 — driver runtime is not yet a complete user journey

The native app has truthful setup and provider boundaries, but assigned-device
provisioning and visible start/stop composition into the capture adapter remain
unfinished. A development build, permission matrix, background recovery, offline
queue, session expiry, and physical Android/iOS evidence are required before
claiming live fleet capability.

### P1 — start and handover mutations need an idempotency contract

Telemetry uploads and several booking/GTFS actions have explicit replay safety,
but tracking-session start and handover generate a new session/credential for
each request. A lost response followed by retry can create a new session or leave
the client without the one-time provider credential. Add an idempotency key bound
to tenant, actor, trip, and command, persist the result/audit outcome, and return
the original response on replay. The database active-session constraint remains
necessary but is not a substitute for command idempotency.

### P1 — connected acceptance evidence is incomplete

The local browser suite intentionally tests honest disconnected/unavailable
states. It does not prove real OIDC, tenant admission, loaded schedule/booking,
provider delivery, ticket/live data, or public booking completion. The local
PostgreSQL concurrency tests also remain skipped without `TEST_DATABASE_URL`.

### P2 — telemetry contract evidence is not fully aligned with ADR intent

ADR-0018 requires accepted positions to carry provider and app-version evidence,
while the current normalized position persistence does not retain those fields
for every provider path. Decide whether those fields belong in the immutable
receipt/history schema, then add provider/app-version contract tests before using
telemetry for operational investigations.

### P2 — moderate dependency debt

The audit found 11 moderate advisories and no high/critical advisories, primarily
through the Expo dependency chain. Assign an owner and remediation window; do
not make an unreviewed broad upgrade part of the web release fix.

### P2 — visual/live browser review is still a limitation

Playwright passed locally and the Impeccable source detector reported no obvious
anti-pattern matches, but the in-app browser connector had no browser available
for live visual inspection. After deployment, review the complete route set at
desktop, narrow mobile, keyboard/focus, zoom, reduced-motion, long-content, and
permission/error states.

## Recommended release sequence

1. Configure the five `staging` environment secrets without placing values in
   Git or workflow logs.
2. Deploy the current API/web image from the immutable release SHA and verify
   the production bridge actually owns all migrated route families.
3. Run the complete live-page inventory above; fail the release on any unexpected
   404, legacy root, wrong content type, or missing build identifier.
4. Configure a disposable approved tenant and execute OIDC sign-in, workspace
   selection, schedule read/write, public booking, manage/cancel, feedback,
   transport ticket, and GTFS readiness journeys.
5. Run PostgreSQL migration, tenancy, authorization, and concurrency evidence
   with an explicit `TEST_DATABASE_URL`.
6. Finish native driver provisioning/start-stop composition and physical-device
   proof before marking fleet tracking complete.
7. Implement start/handover idempotency and align telemetry evidence with ADR-0018.
8. Only then move the release hold in `MASTER_EXECUTION_PLAN.md` and mark the
   affected feature-surface rows as fully verified.

## Audit conclusion

The approach is directionally strong: domain truth, tenancy, privacy, typed
contracts, append-only evidence, universal industry-pack modeling, and honest
degraded states are being handled carefully. The weak point is delivery
discipline: “implemented in source” has been allowed to coexist with “not
deployed,” “locally disconnected only,” and “native boundary exists but the user
journey is not composed.” From this point forward, the release artifact and the
live user journey must be first-class evidence alongside code and tests.
