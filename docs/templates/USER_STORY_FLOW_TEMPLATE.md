# User story and task-flow review

<!-- Copy this template for a user-facing capability. Keep IDs stable after publication. -->

## Identity

- Story ID: `STORY-_____`
- Flow ID: `FLOW-_____`
- Capability ID: `CAP-_____`
- Owner:
- Audience/role:
- Industry Pack/context:
- Status: `planned | in progress | verified | deferred`
- Acceptance references:

## User story

As a **[role]**, I want to **[outcome]**, so that **[reason]**.

Situation and pressure:

Consequence if this fails:

## Capability inventory

Supported actions and outcomes before this change:

-

What this change adds, reorders, groups, renames, hides, defers, or removes:

-

Capability-preservation decision and owner approval, if needed:

## Capability discoverability

- Who can use it (role, permission, branch, entitlement, Industry Pack):
- Where does a first-time user find it?
- What is the plain-language label and outcome description?
- How does the user know whether it is active, needs setup, paused, unavailable,
  expired, denied, or pending?
- Where can the user set/configure it?
- Where can the user revisit/change it later?
- How can the user undo/disable it, and what consequence is explained?
- What contextual links, setup guidance, or search entrypoints help discovery?

## Task flow

| Step | User intent/action | Surface/page | System response | Next step or recovery |
|---:|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

### Entry and prerequisites

- How does the user arrive: navigation, direct link, QR, message, or return path?
- What must be true before starting?
- What does the user see if a prerequisite is missing?

### Alternate and interruption flows

- Back:
- Refresh/deep link:
- Cancel:
- Duplicate submit or retry after an uncertain response:
- Offline/degraded:
- Permission denied:
- Expired/revoked/conflict:
- Provider or unexpected failure:

## Page/state and wording review

| State | Exact user-facing wording | Primary action | Work preserved? | Verified? |
|---|---|---|---|---|
| Loading | | | | |
| Empty/unconfigured | | | | |
| Ready | | | | |
| Validation | | | | |
| Permission denied | | | | |
| Offline/degraded | | | | |
| Pending | | | | |
| Success | | | | |
| Conflict/expired | | | | |
| Unexpected error | | | | |

Copy check:

- Does the first sentence tell the user what happened or what is available?
- Does the primary action use a specific outcome verb?
- Are internal IDs, API terms, blame, and unexplained codes absent?
- Is the explanation short enough for routine use and detailed enough for a
  correct decision?
- Does the next page continue the same terminology and expectation?

## Contract and access checks

- Backend contract:
- Frontend entrypoint:
- Tenant/role/permission rule:
- Idempotency/audit requirement:
- Loading/empty/error/offline/pending/success implementation:
- No fake or invented production data:

## Verification evidence

- Unit/domain:
- Persistence/concurrency:
- API/contract:
- Browser journey:
- Accessibility/keyboard/focus:
- Responsive/mobile/zoom:
- Reduced motion:
- Real deployment/live page:
- Known limitation and owner:

## Completion decision

- [ ] Story and flow are understandable to a non-engineer.
- [ ] Critical path and recovery paths work.
- [ ] Wording is plain, specific, consistent, and appropriately concise.
- [ ] The capability is discoverable, understandable, configurable, usable, and
  revisitable by its intended user.
- [ ] User work and trust are preserved through recoverable failure.
- [ ] No capability disappeared without an explicit decision.
- [ ] Evidence is attached to the stable IDs.
