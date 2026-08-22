# Booking — deployment status

**Last verified: 2026-08-22.**

## Status: API LIVE; WEB RELEASE DRIFT BLOCKS FEATURE ACCEPTANCE

The public hostname is reachable over HTTPS and the API is healthy: `/health/live`
and `/health/ready` both returned 200 on 2026-08-22. The web service currently
serves the legacy static shell at `/`, while the checked-in Next App Router
routes return 404 (`/app`, `/app/transport`, `/trip/example-code`,
`/ticket/example-token`, and `/auth/sign-in`). This is deployment drift, not
a passing product smoke test: the current frontend build is not what users reach.

The intended isolated Booking staging stack remains defined on localhost ports
`3110` (API) and `3111` (web), behind the nginx vhost and Let's Encrypt
certificate. The next release must prove that the deployed web image runs the
Next/legacy bridge from `scripts/serve-web-production.mjs`, then repeat the
route and authenticated smoke tests against the public hostname.

The route-level release gate is `BOOKING_DEPLOYMENT_BASE_URL=<web-origin> npm
run check:deployed-web`. It checks the complete checked-in Next page inventory,
not only `/`, and fails when a route is missing, redirected unexpectedly, or
served by the legacy web release. The staging deployment workflow runs the
same gate against its local web origin before accepting the release.

### Release revision integrity

The workflow deploys the GitHub revision supplied by its `ref` input; it does
not deploy the current uncommitted workstation tree. Before triggering it,
the intended product changes must be reviewed as one coherent commit or pull
request, pushed to GitHub, and verified from that immutable revision. Running
the workflow against `main` while local changes are pending can produce a
successful deployment of an older product and create false confidence.

The required handoff is: choose the reviewed revision, run the staging workflow,
confirm API readiness and the complete 23-route Next smoke gate, then execute
the authenticated OIDC → tenant → real-data journey. Only after those checks
pass should the public hostname be changed or accepted as the Booking release.

The 2026-08-22 release attempt produced immutable candidate
`3c0291266663bc230595882f107f64a4e6230bd0` on
`release/audit-staging-2026-08-22`. Run `32578136392` failed before deployment
because an abbreviated SHA was supplied; retry `32578198091` checked out the
full SHA but failed the secret preflight because the `staging` environment has
none of the five required deployment secrets. No server-side release was
created by either run. Configure the environment secrets before retrying; do
not bypass the preflight or accept the live hostname based on API health alone.

The workflow was then hardened to bind the server release directory and
archive name to the exact checked-out SHA, and run `32596589911` verified that
revision successfully before stopping at the same secret preflight. Its log
now names every missing secret without exposing values.

Local verification follows this status: it does not start Docker Desktop or create a database implicitly. When a server database is provisioned, run the real integration lane with an explicit `TEST_DATABASE_URL`; until then the local lane reports the database proof as skipped rather than consuming workstation resources.

Historical note (superseded by the live verification above): the earlier record
said that `booking.niuautomations.com` resolved to `169.58.155.243`, but nothing was
serving it. That is not an oversight — deploying this today would put a public
URL in front of something with nothing behind it.

What is missing, checked rather than assumed:

| | |
|---|---|
| Dockerfiles | `infra/docker/api/Dockerfile`, `infra/docker/web/Dockerfile` |
| staging compose file | `infra/compose-booking-staging.yaml` |
| git repository | initialised; `main` is pushed to `https://github.com/Gabniu/niubooking` |
| Size | 489 source files pass the 300-line gate; 46 ordered migrations |
| Migration runner | `scripts/run-migrations.mjs` with checksum-protected `npm run migrate` |
| API probes | `/health/live` and database-backed `/health/ready` |
| Communication worker | `apps/worker/src/main.ts`, internal `/health/live` and `/health/ready`, bounded outbox cadence, provider adapters, and a non-root image |
| Server-side entry point | `apps/api/src/server.ts` (Fastify), port from `PORT` |

The web target is Next.js App Router + React + TypeScript (`apps/web/app`) with
the shared Hanken/Booking CSS tokens. The production web image now runs the
Next standalone server behind a small same-origin bridge; unmigrated static
routes such as `feedback.html`, `qr-studio.html`, and `communications.html`
continue through the legacy side of that bridge until their Next replacements
are complete. No new product pages should be added to the legacy side.

## What the staging foundation provides

The checked-in staging compose file creates a separate Booking PostgreSQL
container with no published database port, binds the API and web services to
the server's localhost-only 3110/3111 lane, applies memory limits, uses a
private `172.26.0.0/24` network, and runs migrations before the API starts.
The compose environment expects `BOOKING_DATABASE_URL` with URL-encoded
credentials and a separate `BOOKING_HOLD_SECRET`; credentials are not stored
in the repository.
The compose file also runs `booking-worker` on the private network with no
published port. It owns the outbox delivery loop, exposes port `3200` only to
the compose network, and uses a 256 MB memory limit. Set
`BOOKING_PUBLIC_BASE_URL` and the channel provider endpoint/API-key pairs on
the server when real email, SMS, or voice delivery is enabled. With no
provider configured it remains liveness-healthy but readiness reports that
delivery is not ready; this avoids pretending that messages were delivered.
The same worker performs a bounded GTFS-Realtime projection refresh every 30
seconds by default, limited to 50 enabled public feeds per cycle. Override
`BOOKING_GTFS_REFRESH_INTERVAL_MS` or `BOOKING_GTFS_REFRESH_LIMIT` only after
measuring database and projection cost; the local machine does not need to run
Docker for this contract to be tested.
The API starts in a fail-closed staging mode: public routes and health probes
can be exercised, while staff routes now resolve an opaque HttpOnly session
through `booking_sessions` and a transaction-local active tenant membership.
When the three `AUTH_*` values are configured, the branded `/auth/sign-in` page
hands off through `/auth/login` to the NIU Auth OIDC Authorization Code + PKCE
flow; only an exact local subject mapping can receive a session. The Next web
runtime also needs `BOOKING_API_ORIGIN` so its same-origin auth relay can reach
the Fastify API. Production startup refuses to run without OIDC configuration.
The exact registration and first-user mapping steps are in
`docs/NOVA_AUTH_BOOKING_SETUP.md`.

The connected Next workspace uses same-origin `/v1` calls by default. Only set
`NEXT_PUBLIC_API_BASE` when the browser must call a different API origin; Next
inlines `NEXT_PUBLIC_*` values at build time, so that value belongs in the
image-build environment rather than only the server runtime `.env`.

Rider tickets support an optional MapLibre map through the build-time
`NEXT_PUBLIC_MAP_STYLE_URL`. Use an approved HTTPS style (or localhost during
development) with the provider's required attribution. Do not put private API
secrets in this URL. If it is omitted, invalid, or the style fails to load,
the ticket deliberately falls back to the built-in accessible route diagram;
tracking remains usable and no third-party tile traffic is generated.

CI already provisions an ephemeral PostgreSQL service through
`scripts/run-database-tests.mjs`; local verification still never starts
Docker. The approved server remains the environment for production-shaped
database and deployment smoke tests.

## Explicit staging deployment workflow

`.github/workflows/deploy-staging.yml` is intentionally manual
(`workflow_dispatch`) until the repository remote and staging secrets are
configured. It deploys the selected Git revision to
`BOOKING_STAGING_APP_DIR/releases/<sha>`, keeps the server's `.env` outside the
transferred bundle, validates the compose model, builds the exact API/web
images on the server, and requires both API readiness and web-root probes
before succeeding. Configure these GitHub Environment secrets in `staging`:

- `BOOKING_STAGING_HOST`
- `BOOKING_STAGING_USER`
- `BOOKING_STAGING_SSH_KEY`
- `BOOKING_STAGING_KNOWN_HOSTS`
- `BOOKING_STAGING_APP_DIR`

The server `.env` must provide `BOOKING_DATABASE_URL`, `BOOKING_DB_NAME`,
`BOOKING_DB_USER`, `BOOKING_DB_PASSWORD`, and `BOOKING_HOLD_SECRET`. Production
also requires `AUTH_ISSUER`, `AUTH_CLIENT_ID`, and the exact
`AUTH_REDIRECT_URI` registered in NOVA Auth. Do not put those values in GitHub
source, workflow YAML, or the transferred bundle.

To serve a published GTFS Schedule, configure `GTFS_ARTIFACT_DIR` to a private
read-only directory containing immutable ZIP objects whose keys are recorded in
the database (for example `gtfs/feed-version.zip`). If it is absent, the public
feed route fails closed with a temporary-unavailable response; the application
never creates a placeholder feed.

## The blocking question is not technical

**Booking and the Voice Platform both implement appointments, and both implement
feedback.** That overlap has to be resolved before Booking gets a hostname,
because deploying it creates two live systems that both believe they own the
same records.

The Voice Platform already ships a complete appointment implementation:
PostgreSQL exclusion constraints against double-booking, an availability engine,
slot holds, manual/public/AI booking, transcript-derived suggestions, reminders,
QR booking pages, ICS export and a calendar UI. It also has a feedback module
(forms, campaigns, invites, responses).

Booking duplicates a meaningful part of both:

```
packages/database/src:  feedback.ts, feedback-admin.ts,
                        feedback-responses-admin.ts,
                        communications.ts, communication-outbox.ts
apps/web:               feedback.html, feedback-admin.html,
                        communications.html, qr-studio.html
```

`PROJECT_CONTEXT.md` already names the resolution — a provider boundary in
Voice:

```
BookingProvider
  LocalVoiceBookingProvider   # calls-only customers: Voice's own Scheduler Lite
  RemoteBookingProvider       # premium customers: Booking Core is the truth
  (Booking Core standalone)   # booking-only customers: no telephony at all
```

That boundary is not a migration path, it is the **product tiering mechanism**,
and it maps directly onto the three tiers (booking-only / calls-only / both).
Voice's existing appointment code is not wasted — it becomes the Scheduler Lite
tier.

**Decide the ownership map before deploying.** Suggested, not settled:

| Concept | Owner |
|---|---|
| Identity, accounts, roles | NOVA Identity (`novaauth.niuautomations.com`) |
| Calls, recordings, transcripts, queues | Voice Platform |
| POS, inventory, stores | NOVA POS |
| Appointments, availability | Booking (premium) / Voice-local (calls-only) |
| Feedback campaigns and responses | Booking; Voice triggers and supplies call-quality data |
| **Customer / contact** | **open** — Voice identifies by phone number on a live call with a latency budget; Booking by account and email |

## When it is ready, deploy it like this

The pattern is established by NOVA POS and NOVA Identity on the same host. Do
not invent a different one.

1. **`git init` and a first commit.** Nothing should be deployed from a
   directory with no history.
2. **A production Dockerfile per deployable app.** `apps/api` (Fastify) and
   `apps/web` (Next.js). Copy the shape of `NOVA-POS/infra/docker/auth/Dockerfile` —
   multi-stage, non-root user, healthcheck.
3. **A compose file**, modelled on `NOVA-POS/infra/compose-pos.yaml`:
   - its own PostgreSQL with **no published port**
   - the app bound to **`127.0.0.1` only**, in the **3100–3199** lane (the
     agreed allocation: Voice 8000–8099, NOVA 3000–3099, Booking 3100–3199)
   - an explicit network subnet — `172.26.0.0/24` is free (172.27 identity,
     172.28 nova dev infra, 172.29 POS, 172.30 Voice)
   - `read_only: true`, `no-new-privileges`, tmpfs for scratch paths
4. **A migration runner.** The five `.sql` files need something to apply them in
   order and record what has been applied. There is no such thing today.
5. **An nginx vhost on the host**, then the **two-step** certificate procedure —
   `certbot --nginx` cannot bootstrap a vhost that names a certificate which
   does not exist yet. Copy the header comment from
   `NOVA-POS/infra/reverse-proxy/novapos.nginx.example.conf`.
6. **Federate to NOVA Identity** rather than building another login. Booking has
   `packages/auth` and its own tenant membership; POS has the same problem and
   the same answer.

### Backups are automatic

The host runs a nightly job (02:30 EAT, 14 days) that **discovers** PostgreSQL
containers by image rather than naming them. A Booking database is backed up the
day its container starts, with no configuration. Restore procedure:
`/opt/voice-platform/runbooks/database-restore.md`.

### Host facts you need

- `169.58.155.243`, Ubuntu 24.04, 8 vCPU, 23GB RAM, ~13GB free
- **Shared** with the Voice Platform and NOVA POS — RAM and ports are a shared
  budget. Check `free -g` before adding containers.
- Host nginx on 80/443 is the **only** public listener; one vhost per app in
  `/etc/nginx/sites-available/`
- Traefik was considered and rejected: nginx is already there, already carries a
  hard-won fix in its Voice Platform config, and Traefik's dynamic discovery
  buys nothing for a handful of hand-deployed apps

## Traps already paid for elsewhere

These cost time on the POS deployment. They apply to any Node/Next app here.

- **Next.js evaluates `rewrites()` at build time.** A destination read from
  `process.env` inside `next.config.ts` is frozen into the image; setting it at
  runtime does nothing and every proxied call fails with `ECONNREFUSED` to the
  build-time default. Route at nginx instead.
- **`next build` sets `NODE_ENV=production`**, so any module-level config
  assertion fires during the build, before real values can exist. Supply inert
  build-time placeholders — safe for anything that is not `NEXT_PUBLIC_`, since
  only those are inlined into the bundle.
- **A `.dockerignore` is load-bearing**, not an optimisation. It keeps a local
  `.env` out of an image layer and stops stale build caches poisoning a
  production install.
- **Bind every port to `127.0.0.1`.** A bare `"5432:5432"` binds every
  interface including the public IP. `ufw` will not save you — Docker's DNAT
  rules bypass it for published ports on this host, so the compose bind address
  is the real control.
