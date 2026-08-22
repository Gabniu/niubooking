# AGENTS.md — Booking & Service Operations Platform

These instructions apply to every task in this repository.

## Start every session here

1. Read `PROJECT_CONTEXT.md`.
2. Read `MASTER_EXECUTION_PLAN.md`.
3. Read the relevant ADRs in `docs/architecture/`.
4. Read `docs/DESIGN_SYSTEM.md` before changing UI.
5. Inspect the repository, existing contracts, tests, and current Git state before editing.
6. Query `graphify-out/graph.json` before answering architecture or relationship questions when it exists.
7. Keep the project graph current: after durable code, product-flow, capability,
   or architecture changes, run the Graphify update and Obsidian export. When a
   graph relationship informs an audit, plan, or decision, reference the relevant
   graph report/node/path instead of relying only on memory or file search.

## Product doctrine

- Build a universal service-delivery platform, not a generic appointment calendar.
- Model service-delivery mechanics as reusable primitives; Industry Packs compose them into specialized products.
- Driving School is the first deep vertical, not the universal domain vocabulary.
- Dental and Salon are mandatory architecture tests so the product does not become Driving-School software internally.
- The standalone Booking product must work and feel complete without Voice.
- Voice remains separately purchasable. Premium customers unlock integrated Voice + Booking capabilities.
- Booking owns customer, service, resource, availability, booking, package, fulfillment, and outcome truth.
- Voice owns telephony, calls, queues, recordings, transcripts, AI turns, and call quality.
- AI may interpret, explain, simulate, recommend, and present deterministic choices. It must not invent availability or bypass domain invariants.

## Engineering rules

1. Build to verify. A change is incomplete until its relevant tests and verification gates pass.
2. Keep source files at approximately 300 lines or fewer. Split by responsibility before exceeding the limit. Generated files and documentation are exempt, but must remain navigable.
3. Every source file begins with a short ownership comment. Explain non-obvious constraints and why they exist.
4. Prefer focused components, services, domain modules, and shared utilities over large files or duplicated logic.
5. Preserve strict TypeScript and typed server contracts. Avoid `any`, unvalidated JSON, and stringly typed domain rules.
6. Keep domain logic independent from UI, HTTP, providers, and persistence where practical.
7. Use database constraints for invariants that concurrency can violate. Application pre-checks are not guarantees.
8. All externally triggered mutations require idempotency and audit evidence.
9. Every tenant-owned row is tenant scoped. Authentication never substitutes for local tenant admission and authorization.
10. Never store secrets in source, browser storage, logs, fixtures, or generated artifacts.
11. Use append-only events/ledgers for history-sensitive operations such as credits, payments, audits, and integrations.
12. Do not create microservices until a measured scaling, deployment, security, or ownership boundary requires one.

## Backend-to-frontend parity

- Before closing any feature or milestone, audit backend capabilities against frontend surfaces.
- Classify every new or changed backend capability as `user-facing`, `integration-only`, `operations/internal`, or `intentionally deferred` in `docs/FEATURE_SURFACE_MATRIX.md`.
- A `user-facing` backend capability is incomplete until its discoverable frontend entry point, permissions, validation, loading, empty, error, offline/degraded, pending, success, and responsive/accessibility behavior are implemented and verified.
- Do not create UI for machine endpoints, webhooks, health checks, internal jobs, or privileged operational controls unless a real authorized user workflow requires it.
- An intentionally deferred surface must have an owner, reason, target phase, and acceptance reference. “Backend done” is not a valid completion state for a required user workflow.
- Also audit the opposite direction: frontend controls must not be decorative, disconnected, backed by fake production data, or call nonexistent contracts.

## User stories, task flows, and humane language

- Every user-facing capability must begin with a stable user-story ID and a
  named task flow. A user story states who is trying to achieve what and why; a
  task/user flow maps the steps, pages, decisions, mutations, and recovery paths
  from trigger to outcome; a user journey is the larger end-to-end experience
  before, during, and after the task.
- Before implementation and again before closure, review the story and flow from
  the user's point of view. Check entrypoint, prerequisites, page-to-page
  transitions, back/refresh/deep-link behavior, loading, empty, validation,
  permission, offline/degraded, pending, success, and recovery states. A route
  existing is not evidence that the flow works.
- Product simplification must reduce cognitive load, not remove capability.
  Compare the intended capability inventory before and after the change; every
  removed, hidden, renamed, or deferred capability needs an explicit decision,
  owner, reason, and acceptance reference.
- Every retained capability needs a discoverability contract: who can use it,
  where they find it, what it does in plain language, whether it is enabled or
  configured, how they set or change it, how they undo or disable it, and what
  happens next. Prefer a visible contextual entrypoint, setup prompt, or
  searchable destination over expecting users to remember a deep URL. A feature
  is not meaningfully available if it exists in the backend but users cannot
  find, understand, configure, or revisit it.
- Treat interface wording as part of the product contract. Use plain language
  for the actual audience, stable terms from the active Industry Pack, and one
  clear next action. Avoid API/database language, unexplained codes, internal
  IDs, blame, vague “something went wrong” messages, and copy that assumes an
  engineer is operating the product.
- For status and error copy, prefer: what happened; what it means for the user;
  what they can do next. Give the shortest useful explanation first, then put
  technical detail, troubleshooting, or a reference ID behind progressive
  disclosure or a support path. Do not over-explain routine states or hide
  important consequences behind a tooltip.
- Check wording at every transition, not only in isolated components: the page
  title, primary action, field labels, helper text, validation, confirmation,
  toast/banner, empty state, retry action, and next-page handoff must tell one
  consistent story. “Success” must explain what is now true and what happens
  next; “error” must preserve the user's work whenever safe.
- User-story and flow evidence is required in addition to unit and route tests.
  The reusable standard and review template live in
  `docs/USER_STORY_AND_FLOW_STANDARD.md` and
  `docs/templates/USER_STORY_FLOW_TEMPLATE.md`.

## Frontend rules

- Follow `docs/DESIGN_SYSTEM.md` and NOVA ADR-0036.
- Use Hanken Grotesk across product surfaces.
- Booking has a modern, compact operational identity: white rail and workspace,
  Niu Booking blue actions (`#140BA7`), and restrained Industry Pack accents.
- Industry Pack accents supplement the brand; they never replace the primary
  blue action system. Emerald is reserved for success/positive status.
- No gradients, excessive glassmorphism, invented metrics, or fake production
  data. Booking blue is a solid product token, not a decorative gradient.
- Every screen defines loading, empty, error, offline, permission-denied, and success states.
- Design and verify desktop, tablet, narrow mobile, keyboard, focus visibility, zoom, long content, and reduced motion.
- Controls preserve at least a 48px touch target. Use an 8px spacing rhythm.

### External frontend skill routing

- Use Taste `design-taste-frontend` for visual direction from a brief and
  `redesign-existing-projects` for existing-screen audits.
- Use Anthropic `frontend-design` for distinctive, intentional composition.
- Use Impeccable after implementation for visual, accessibility, responsive,
  content, and state audits.
- Use Emil `emil-design-eng` for component craft; use `animate` only for a
  named interaction and animation review skills for motion audits.
- The approved web stack is Next.js App Router + React + TypeScript. Use
  shadcn/MCP only after `components.json` is established for the Next app;
  never create a second component/token system. Legacy HTML fixtures may remain
  only as a time-boxed migration bridge, not as the target for new pages.
- Local Booking rules, contracts, permissions, tokens, and accessibility win
  whenever external skill guidance conflicts.

## Authentication and authorization

- Use NOVA shared Better Auth via OAuth 2.1/OIDC Authorization Code + PKCE.
- Map the stable identity `sub` to a local user.
- Resolve tenant membership, roles, branch access, permissions, and entitlements from current local state.
- Never authorize from email, an organization claim, an ID token alone, or an arbitrary tenant ID in a request body.
- Human login never uses API keys. Machine credentials are separately scoped, rotatable, revocable, and audited.
- Federation migration remains fail-closed and reversible until issuer, audience, JWKS, expiry, state, nonce, PKCE, revocation, and local admission tests pass.

## Required verification

Run the gates proportional to the change, and record the result:

- formatting and lint;
- static analysis and strict typecheck;
- unit tests for changed domain behavior;
- integration tests for persistence, tenancy, authorization, and API contracts;
- concurrency tests for booking and allocation mutations;
- contract tests for Voice/Booking events and APIs;
- production build;
- focused browser tests for changed journeys;
- accessibility checks for changed UI;
- migration forward/backward checks when schema changes;
- Graphify update and Obsidian export when durable architecture relationships change.
- Graphify query/update evidence for architecture, capability, and cross-surface
  relationship decisions; the graph is part of the project's durable audit trail.
- backend-to-frontend surface parity audit for every changed capability.
- user-story/task-flow review and plain-language content/state audit for every
  changed user-facing capability.

Never silence a failing gate to make the pipeline green. Fix the defect or document an explicit, reviewed exception.

## Git and documentation

- Preserve unrelated user changes.
- Use small, coherent commits with conventional prefixes.
- Update `MASTER_EXECUTION_PLAN.md` when a gate, phase, decision, or known risk changes.
- Add an ADR for durable architectural decisions.
- Keep requirements, tests, risks, and ADRs traceable by stable identifiers.
