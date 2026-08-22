# User-flow and route audit

## Purpose

This is the reachability companion to the feature matrix. A capability is not
considered user-facing merely because a backend endpoint or component exists:
an authorized user must have a clear entrypoint, and every applicable state must
lead to a safe next action. Run `npm run check:routes` whenever a route,
navigation item, public link, or contextual action changes.

The audit also checks capability discoverability. For each retained feature, ask
whether the intended user can find it without knowing an internal name, understand
its current state, reach setup/configuration, use it, change or disable it later,
and find the next useful action. Simplification may reorganize or progressively
disclose a feature, but it must not remove the capability or leave it reachable
only through an undocumented deep link. Use the review form in
`docs/templates/USER_STORY_FLOW_TEMPLATE.md` for new or changed flows.

## Audited flows

| Flow | Audience | Entry | Successful path | Recovery states checked | Status |
|---|---|---|---|---|---|
| Prospect to workspace | Organization staff | `/` → `Continue with Booking` | `/auth/sign-in` → NIU Auth callback → `/app` → workspace selection → schedule | Unauthenticated, loading, denied, unavailable, sign-in recovery | `verified locally` |
| Daily staff operations | Authorized staff | Workspace navigation | `/app/schedule` → create booking → resource-aware availability → confirm → status action | Empty schedule, missing customer, unavailable resource, conflict, reload | `verified locally` |
| Service configuration | Authorized staff | `/app/services` → `Configure` | `/app/service-composition?service=...` → variants/requirements → advisory candidate times | Missing workspace, missing service, validation failure, failed save, retry | `verified locally` |
| Industry setup | Workspace administrator | `/app/packs` → `Configure a workspace` | `/app/pack-settings` → select pack → approved overrides → materialize services | Unauthorized, invalid override, duplicate submit, stale reload | `verified locally` |
| QR/public appointment | Client | QR code or booking link | `/book/[code]` → service/time → hold → contact/consent → confirmation → `/manage/[token]` | Missing/invalid/expired code, conflict, unavailable capacity, retry-safe confirmation | `verified locally` |
| Public occurrence reservation | Passenger/client | QR code or occurrence link | `/reserve/[code]` → published occurrence → capacity-aware reservation → reminder consent | Missing/invalid code, full occurrence, idempotent retry, unavailable service | `verified locally` |
| Client change of plans | Client | Confirmation or reminder link | `/manage/[token]` → reschedule or cancel → confirmation | Expired/revoked token, policy denial, stale slot, retry-safe action | `verified locally` |
| Feedback conversation | Client | Approved feedback capability link | `/feedback/[capability]` → creator-selected compact, stepped, or conversational flow → submit | Expired, already used, unavailable, required-answer validation, retry | `verified locally` |
| Contact verification | Client | Verification message | `/verify-contact/[challenge]` → six-digit code → verified contact | Missing, invalid, expired, locked, unavailable | `verified locally` |
| Degraded workspace | Staff | Any protected workspace route | Honest disconnected/denied/error state → sign in, choose workspace, or retry | No sample data is shown and no dead-end controls are presented | `verified locally` |

## Route reachability contract

### Staff routes

The workspace shell is the source of truth for primary staff navigation. The
route gate confirms that every shell item has a real Next App Router page:

`/app`, `/app/schedule`, `/app/customers`, `/app/services`,
`/app/resources`, `/app/occurrences`, `/app/feedback`, `/app/communications`,
`/app/gtfs`, `/app/transport`, `/app/packs`, `/app/pack-settings`, and
`/app/qr-studio`.

Service composition is deliberately contextual rather than a separate primary
menu item; the services catalog must expose its `Configure` action. Pack settings
is likewise reachable from both the shell and the pack catalog.

### Public and authentication routes

Public routes are link/QR destinations, not workspace menu items. The gate
requires an explicit source category for each dynamic route so a future route
cannot be added as an orphan. Authentication callback/login are route handlers;
they are reached by the branded sign-in page and the NIU Auth provider.

### Compatibility bridges

The legacy HTML files remain during the strangler migration and are covered by
browser journeys. They are not treated as separate product capabilities. New
work must land in the Next route/component first; a bridge is only retained when
deployment or an existing link still requires it.

## Intentional non-reachability

Worker probes, provider adapters, audit persistence, and transport route/trip
contracts are not missing UI. They are integration or operations surfaces, or
the first deferred transport foundation slice. Transport staff route search,
trip manifests, conductor workflows, and live vehicle telemetry remain behind
BATCH-004/BATCH-005 until additive persistence, authorization, and realtime
delivery are implemented. No transport controls are exposed prematurely.

## Evidence and remaining risk

- `npm run check:routes` validates route files, shell navigation, contextual
  actions, and disconnected-state recovery links.
- `tests/e2e/workspace-shell.spec.mjs` exercises public, auth, staff, legacy
  bridge, QR, booking, occurrence, manage, feedback, and verification states.
- `npm run check:parity` keeps backend capability rows paired with their intended
  frontend or explicit non-UI classification.
- A live production smoke pass with the real NIU Auth client, tenant membership,
  provider credentials, and a deployed database is still required before any
  capability is marked fully verified. Local route reachability does not prove
  provider callback or delivery configuration.
- Owner audit correction (2026-08-22): the public hostname was reachable, but
  `/` served the legacy static shell and the checked-in Next paths (`/app`,
  `/auth/sign-in`, and the public dynamic families) returned 404. The table's
  `verified locally` labels are source/local evidence, not deployed acceptance;
  connected production journeys remain blocked until the current web release is
  deployed and exercised with real OIDC, tenant membership, and persistence.
