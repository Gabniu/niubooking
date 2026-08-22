# User-story and task-flow catalog

This is the starting catalog for the current Booking surface. It is deliberately
organized around what a person is trying to do and how they move between pages,
not around API endpoints. Stable IDs must be preserved when a route or component
is renamed. Each row should eventually link to the detailed review template and
journey evidence.

## Graph evidence

The current Graphify graph contains 3,665 nodes, 5,921 edges, and 346
communities. A BFS query on the presentation flow connected
`customerDisplayName()`, `schedule-page.tsx`, `occurrences-page.tsx`,
`transport-operations-page.tsx`, `customers-client.ts`, `userFacingMessage()`,
and the existing `USER_FLOW_AUDIT.md`. This confirms that staff-facing names
are a cross-surface relationship, not an isolated page concern; changes to
schedule, reservations, manifests, or copy should re-check those connected
nodes.
The durable source is `graphify-out/graph.json`; the refreshed Obsidian view is
`graphify-out/obsidian/`.

## Public and identity flows

| Story / flow | Entry | Main path | Discoverability and next step |
|---|---|---|---|
| `STORY-PUB-001` / `FLOW-PUB-001` Prospect understands Booking | `/` | Learn the shared model → choose `Sign in` or `Start with Booking` → `/auth/sign-in` | Public header and hero provide the same sign-in destination; capability sections explain appointments, classes, trips, QR booking, and feedback |
| `STORY-AUTH-001` / `FLOW-AUTH-001` Staff signs in | `/auth/sign-in` | Read why access is needed → start NOVA Auth → callback → `/app` | Must explain that access is based on current organization membership, not expose provider errors |
| `STORY-BOOK-010` / `FLOW-BOOK-010` Guest books through a link | `/book/[code]` | Understand service → choose time → provide contact/consent → hold → confirm → `/manage/[token]` | Link must explain unavailable/expired states and the confirmation page must expose the manage path |
| `STORY-OCC-001` / `FLOW-OCC-001` Guest reserves a published session | `/reserve/[code]` | Review session → choose quantity/time → provide name and optional reminder consent → confirm | Full/unavailable state must offer another session or explain that no places are currently published |
| `STORY-MANAGE-001` / `FLOW-MANAGE-001` Customer changes plans | `/manage/[token]` | Read current booking → reschedule or cancel → receive confirmed result | Expired, already changed, conflict, and retry states must preserve the user's intent and explain the next option |
| `STORY-FBK-001` / `FLOW-FBK-001` Customer gives feedback | `/feedback/[capability]` | Read purpose → answer creator-defined questions → submit once → confirmation | The experience must explain progress, required answers, expiry, duplicate submission, and what happens after sending |
| `STORY-CONTACT-001` / `FLOW-CONTACT-001` Customer verifies contact | `/verify-contact/[challenge]` | Read why verification is needed → enter code → verified/expired/locked result | Invalid and expired code states must explain whether to request a new message or contact the organization |
| `STORY-TRN-001` / `FLOW-TRN-001` Rider views a ticket | `/ticket/[token]` | Read route, stops, fare, and boarding window → open live trip when available | Ticket must distinguish unavailable, stale, offline, revoked, and live states; no internal IDs |
| `STORY-TRN-002` / `FLOW-TRN-002` Rider follows a trip | `/trip/[code]` | Choose/find trip → review departure/capacity → reserve or open scoped live status | Live movement is an estimate with last-updated/freshness language, never a promise |

## Staff workspace flows

| Story / flow | Entry | Main path | Discoverability and next step |
|---|---|---|---|
| `STORY-STAFF-001` / `FLOW-STAFF-001` Staff enters a workspace | `/app` | Sign in → choose authorized organization → choose branch/context → schedule | Workspace selection must use understandable organization labels; raw tenant IDs are not a user-facing name |
| `STORY-SCH-001` / `FLOW-SCH-001` Staff operates the schedule | `/app/schedule` | Review current appointments → create/update status → recover from conflict or unavailable data | `New appointment` is available in the header and from the empty state; no compatibility/engineering wording should be exposed |
| `STORY-CUST-001` / `FLOW-CUST-001` Staff manages customer profiles | `/app/customers` | Search/list → create/edit/archive/restore → return to the task that needs the customer | Empty state should explain that a profile is needed and provide the create action |
| `STORY-SVC-001` / `FLOW-SVC-001` Staff makes a service bookable | `/app/services` | Search/list → add service → activate/deactivate → `Configure` → `/app/service-composition?service=...` | The catalog must make configuration, current status, and the next setup step obvious |
| `STORY-SVC-002` / `FLOW-SVC-002` Staff configures service requirements | `/app/service-composition` | Select service → add variants → define resource/capability requirements → inspect candidate times | Missing service state links back to the catalog; technical capability keys need plain-language help |
| `STORY-RES-001` / `FLOW-RES-001` Staff manages capacity | `/app/resources` | Add room/person/vehicle/equipment → activate/pause → use in booking/service setup | Empty state explains what a resource enables; status controls say the consequence, not only `active/inactive` |
| `STORY-OCC-002` / `FLOW-OCC-002` Staff publishes an occurrence | `/app/occurrences` | Create dated occurrence → review reservations → update lifecycle | Empty state should lead to `Create occurrence`; capacity and lifecycle terms need audience wording |
| `STORY-COM-001` / `FLOW-COM-001` Staff controls reminders and changes | `/app/communications` | Set policy → add reminder rule → manage contact method → open feedback campaigns | Each setting must explain who it affects, when it applies, and where to verify delivery/consent |
| `STORY-FBK-002` / `FLOW-FBK-002` Staff manages feedback | `/app/feedback` | Create campaign → create template version → enable/pause → inspect aggregate results | Campaign IDs and template versions are configuration details; labels should lead with audience/outcome |
| `STORY-PACK-001` / `FLOW-PACK-001` Staff chooses an industry pack | `/app/packs` | Compare pack purpose → `Configure a workspace` → `/app/pack-settings` | Catalog cards must explain what changes, what stays universal, and what setup is still required |
| `STORY-PACK-002` / `FLOW-PACK-002` Staff configures a pack | `/app/pack-settings` | Select pack → set allowed terminology/accent → materialize services → return to service setup | Current selection, unsaved changes, materialization result, and safe reconfiguration must be clear |
| `STORY-QR-001` / `FLOW-QR-001` Staff creates a public booking destination | `/app/qr-studio` | Choose destination → preview → inspect scan safety → print/download → pause/replace/revoke | The page must explain where the QR leads, whether it is active, and how to revisit or replace it |
| `STORY-TRN-003` / `FLOW-TRN-003` Staff plans transport | `/app/transport` | Create route → publish dated trip → inspect manifest → board/manage passenger state | The UI must explain route vs trip vs occurrence in human terms; internal IDs need contextual labels or selection |
| `STORY-GTFS-001` / `FLOW-GTFS-001` Staff publishes a transit feed | `/app/gtfs` | Review readiness → generate/validate → publish/withdraw/rollback → monitor freshness | Readiness must explain what needs fixing; publication state must distinguish candidate, active, withdrawn, and stale |

## Cross-flow rules

1. Every row has a visible entrypoint, a meaningful empty/setup state, and a
   next action. A backend capability without a discoverable surface is not done.
2. Every mutation has a confirmation that states what became true and where the
   user can continue. Technical status codes stay behind the interface.
3. Every failure says what happened, what was preserved, and what the user can
   do next. Retry is not the only recovery when another choice is possible.
4. Every deep link, refresh, back action, and return from a child page preserves
   enough context to continue safely.
5. Every industry pack may adapt vocabulary, but it may not hide universal
   capabilities or make the platform's core concepts impossible to find.
6. No feature is removed as part of a wording, navigation, or visual cleanup.
   Reorganization and progressive disclosure require capability-inventory review.

## Current first-pass findings

- The schedule empty state exposed “compatibility booking form,” which is
  implementation language and sent users to a legacy page. It now opens the
  existing appointment dialog in place and uses `Add first appointment`.
- Schedule appointment rows now resolve customer names through the existing
  authorized customer-profile contract and use `Customer name unavailable`
  instead of exposing an opaque customer identifier when that lookup fails.
- Occurrence reservations and transport manifests now use the same customer
  display-name resolver and preserve the explicit fallback when the profile
  list is unavailable.
- Communication contact cards and customer selectors now lead with customer
  names; internal identifiers remain available only to the action contract.
- Legacy booking, occurrence, and communication compatibility pages now follow
  the same visible-name rule while retaining their existing API identifiers.
- Workspace selection now leads with an honest human label and moves the raw
  tenant value into `Workspace reference:` detail. The backend contract still
  needs an authoritative organization display name before the placeholder can
  be replaced with a real name.
- Some staff surfaces expose internal identifiers or technical terms in labels
  and summaries. These are content/contract follow-ups, not reasons to remove
  the underlying capability.
- Public and staff live deployment drift remains a separate release blocker;
  local flow work cannot be accepted as live evidence until the current web
  release is deployed.
