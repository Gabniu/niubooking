# User-story, task-flow, and humane-language standard

## Why this exists

Booking is used by people who are trying to complete service work, not by
engineers who want to inspect an API. A feature can be technically correct and
still feel difficult, ambiguous, or unsafe if the user does not know where to
start, what just happened, or what to do next.

This standard makes user understanding part of the product contract. It applies
to public customers, organization staff, managers, administrators, drivers,
conductors, riders, support users, and any other human-facing surface.

It does not authorize removing capabilities to make a flow look simpler. The
goal is to preserve the full capability set while improving sequencing,
grouping, defaults, wording, progressive disclosure, and recovery.

The primary usability question is not only “can the user complete this task?”
It is also “can the user discover this capability, understand it, set it up,
use it, and find it again later?” A feature that technically exists but is
buried, unlabeled, or impossible to configure is not accessible product value.

## Shared vocabulary

Use these terms consistently:

| Term | Meaning | Required artifact |
|---|---|---|
| User story | A role, desired outcome, and reason: “As a __, I want __, so that __.” | Stable `STORY-*` ID and acceptance criteria |
| Task flow / user flow | The concrete path from trigger to outcome: pages, actions, decisions, mutations, and recovery | `FLOW-*` map or table linked to the story |
| User journey | The wider experience before, during, and after one or more tasks | Journey context when the capability crosses lifecycle stages |
| Information scent | The cues that help a person predict where a link/action leads | Entry labels, headings, navigation, and handoff copy |
| Content design / UX writing | The words that guide, explain, validate, confirm, and recover | Copy inventory and state review |
| Capability inventory | The complete set of supported actions and outcomes, including less-common paths | Before/after preservation check |

When discussing a page-to-page path, call it a **task flow** or **user flow**.
Use **journey** when the discussion includes the broader lifecycle, emotions,
channels, or time before and after the immediate task.

## The required chain

Every user-facing capability follows this chain:

```text
Capability
  -> user story and audience
  -> trigger, context, and preconditions
  -> happy-path task flow
  -> alternate, interruption, and recovery paths
  -> page/state/content contract
  -> implementation
  -> journey-based verification
  -> evidence and capability-preservation review
```

The flow is not complete when the happy path works. It is complete when the user
can understand and recover from the meaningful states without needing internal
knowledge.

## Story and flow design method

### 1. Start with the person and outcome

Write the story in the user's language, not the implementation's language.
Include role, situation, desired outcome, reason, and consequence of failure.
Identify whether the person is a first-time user, returning user, operator under
time pressure, or a specialist with domain knowledge.

Example:

> As a branch manager preparing tomorrow's lessons, I want to see which
> instructors and vehicles can support each lesson, so that I can resolve
> conflicts before customers arrive.

Not:

> As an admin, I want to query the allocation endpoint.

### 2. Map the flow before choosing the UI

Record:

- trigger and entrypoint, including QR/deep links and returning-user paths;
- prerequisites and what happens when one is missing;
- each page/surface, decision, field, action, and server mutation;
- what the user sees while work is loading or pending;
- successful outcome and the next useful action;
- alternate choices, back, cancel, refresh, timeout, duplicate submit, and
  interrupted-session behavior;
- permission-denied, expired-link, conflict, offline, provider, and unknown
  failure paths;
- what data is retained, cleared, or safely resumable at each transition;
- desktop, narrow mobile, keyboard, zoom, reduced-motion, and assistive-tech
  implications.

Use real page names and human actions. “POST `/v1/foo`” is supporting contract
evidence, not a task-flow step.

### 3. Define the page/state contract

For every page or meaningful component state, specify:

| State | User needs to understand | Required behavior |
|---|---|---|
| Loading | What is being prepared | Set expectation without fake progress; preserve context |
| Empty | Why there is nothing yet | Explain whether setup, filtering, or absence is responsible; give a useful next action |
| Ready | What is available and what matters | Use clear hierarchy; make the primary task obvious |
| Validation | What needs correction | Point to the field/step, explain the rule in plain language, preserve valid work |
| Permission denied | What the user is allowed to do | Say access is unavailable and who/what can resolve it; do not expose authorization internals |
| Offline/degraded | What cannot be confirmed right now | Say what is safe to do, what is paused, and when retry is appropriate |
| Pending | Whether the action was received | Disable unsafe duplicate actions, show progress honestly, support safe recovery |
| Success | What is now true | Confirm the result and provide the next useful action or destination |
| Conflict/expired | Why the requested result changed | Explain the new choice or recovery path; never silently discard the user's intent |
| Unexpected error | What the user can do now | Give a plain retry/support action; expose technical reference only when useful |

Not every surface needs every state visually, but every applicable state must be
decided. “No data” must not be used to conceal an error, permission denial, or
unconfigured integration.

## Humane language rules

### Default message shape

For status, validation, and error messages use this order:

```text
What happened. What it means. What to do next.
```

Examples:

- “We couldn’t load today’s schedule. Your bookings were not changed. Try
  again, or choose another date.”
- “That time is no longer available. Choose one of the available times below.”
- “Your feedback was sent. You can close this page now.”

Avoid:

- “API error 409”;
- “Invalid resource allocation”;
- “Something went wrong” with no next step;
- “You failed to…” or other blame-oriented wording;
- internal tenant IDs, database names, stack traces, or provider terminology.

### Calibrating explanation

Use progressive disclosure:

1. Give the shortest sentence that lets the person decide what to do.
2. Add one primary next action and, only when needed, one secondary action.
3. Explain the reason when it changes the user's choice, trust, or safety.
4. Put troubleshooting detail, technical references, and support diagnostics in
   an expandable detail region or support handoff.

Under-explaining leaves the user guessing. Over-explaining makes routine work
slow and hides the decision. The test is: can the intended user act correctly
after reading the first sentence and seeing the primary action?

### Labels and actions

- Name the user's outcome: `Confirm booking`, `Save changes`, `Try again`,
  `Choose another time`, `Stop sharing location`.
- Prefer specific verbs over generic `Submit`, `Continue`, `Manage`, or `OK`.
- Keep the same concept named the same way across navigation, headings, buttons,
  notifications, email/SMS links, and the next page.
- Never make a destructive action ambiguous. Name the object and consequence:
  `Cancel this booking` or `Stop sharing location`.
- Explain unusual terms at first use; let an Industry Pack adapt vocabulary only
  when the active audience would genuinely understand it better.
- Do not use a tooltip as the only place where a required instruction exists.

### Preserve user work and trust

- Keep entered values when validation or network failure permits.
- Never claim success before the authoritative mutation is confirmed.
- Make retry safe and explain whether the first attempt may have succeeded.
- Distinguish unavailable, empty, expired, denied, and failed states.
- Tell the user when a result is an estimate, stale, pending, or awaiting review.
- Do not make people repeat information that the system already knows safely.

## Capability preservation rule

Before simplifying a flow, inventory all supported capabilities, roles, edge
cases, and destinations. After the change, compare the inventory:

| Change | Required decision |
|---|---|
| Reworded | Confirm terminology and meaning are preserved |
| Reordered | Explain why the new sequence reduces effort or risk |
| Grouped/hidden | Record discoverability, permission, and accessibility evidence |
| Renamed | Provide migration/redirect/handoff copy where links or habits exist |
| Deferred | Record owner, reason, target phase, and acceptance reference |
| Removed | Requires explicit product-owner approval; never infer from a UI cleanup |

“The backend still supports it” is not sufficient when a user-facing capability
has lost its discoverable entrypoint.

## Capability discoverability contract

For every retained user-facing capability, document and verify:

| Question | Product requirement |
|---|---|
| Who can use it? | Role, permission, tenant, branch, entitlement, and Industry Pack context are visible or inferable without technical knowledge |
| Where do they find it? | Navigation, contextual action, setup checklist, notification, QR/deep link, or search entrypoint is intentional and reachable |
| What does it do? | Label, heading, helper text, and empty/setup state describe the user outcome, not the endpoint or data model |
| Is it ready? | The current state is clear: enabled, needs setup, unavailable, paused, expired, denied, pending, or active |
| How do they set it? | The configuration path is discoverable from the feature, relevant workspace, or setup guidance; required prerequisites are explained in order |
| How do they change it? | The user can revisit the setting without starting over or relying on a remembered URL |
| How do they undo or disable it? | Reversible controls explain the consequence and preserve history/audit where required |
| What happens next? | The feature confirms the result and links to the next useful task or related capability |

Use progressive disclosure and contextual grouping to keep the interface calm;
do not hide capability merely to reduce visible navigation. If a feature is
rare, place it under a clear category, provide contextual links from the task
where it matters, and make it searchable or reachable from setup/help. If it is
important to daily work, it should not be discoverable only through an obscure
settings page.

### Discoverability acceptance checks

- A first-time intended user can locate the capability without knowing its
  internal name.
- A user can tell whether it is configured, active, unavailable, or denied.
- The feature explains prerequisites before the user encounters a dead end.
- Configuration and use are linked when the user is ready to act.
- A returning user can find the feature again from a stable location.
- Permission and Industry Pack differences change the explanation and available
  action honestly, without making the feature appear broken.
- The discoverability path is tested at desktop, narrow mobile, keyboard, zoom,
  and assistive-technology-relevant sizes.

## Verification method

For each changed story:

1. Run the flow as a first-time user with no internal context.
2. Run it as a returning user entering through a deep link, refresh, or back.
3. Interrupt it at loading, pending, offline, timeout, conflict, and permission
   boundaries.
4. Read every visible message in isolation and ask what action it suggests.
5. Test desktop, narrow mobile, keyboard/focus, zoom, and reduced motion.
6. Use real API/persistence boundaries for the critical success path; mocks may
   supplement but never replace it.
7. Verify capability preservation against the before/after inventory.
8. Record evidence under the story and flow IDs in the test catalog or batch
   document.

Automated tests should describe user intent where practical:

```text
STORY-BOOK-003 / FLOW-BOOK-003
Guest selects a time -> time becomes unavailable -> user sees why ->
user chooses another valid time -> booking can continue without re-entering details
```

Route tests prove reachability. Component tests prove local state. Journey tests
prove that the person can complete and recover from the task.

## Completion gate

A user-facing capability is not complete until all applicable items are true:

- story, audience, outcome, and flow IDs are documented;
- happy path and meaningful alternate/recovery paths are mapped;
- every applicable state has clear, audience-appropriate wording and a next step;
- wording uses the active product/Industry Pack glossary consistently;
- valid user work survives recoverable errors;
- permissions, tenant boundaries, and backend contracts are reflected in the UI;
- capability inventory was compared and no feature disappeared accidentally;
- journey tests cover the critical path and at least one interruption/recovery;
- responsive, keyboard, focus, zoom, reduced-motion, and accessibility evidence
  is recorded for the changed surface;
- known gaps have an owner, reason, target phase, and acceptance reference.

The reusable review form is `docs/templates/USER_STORY_FLOW_TEMPLATE.md`.
