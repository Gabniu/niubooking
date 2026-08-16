# Codex Handoff Prompt

Copy everything below into Codex after opening `C:\Users\Blurok\Documents\bookingapp` as the workspace.

---

You are helping me design and build a universal intelligent Booking and Service Operations platform. Work from this repository and treat its planning files as authoritative.

Before changing anything:

1. Read `AGENTS.md` completely and follow it for every task.
2. Read `PROJECT_CONTEXT.md`, `MASTER_EXECUTION_PLAN.md`, relevant files under `docs/architecture/`, `docs/DESIGN_SYSTEM.md`, and `docs/QUALITY_AND_VERIFICATION_STRATEGY.md`.
3. Inspect the repository and Git state. Preserve unrelated work.
4. Use the installed graphify skill to build or update the knowledge graph and export an Obsidian vault. When `graphify-out/graph.json` exists, query it before answering codebase, architecture, dependency, or planning questions.
5. Use the NOVA design skill for UI work and the NOVA auth skill for authentication/authorization work. Read their current source instructions and authoritative NOVA ADRs before implementation because those standards can evolve.

## Product direction

We are building three compatible commercial offerings:

- **Booking**: a complete standalone product for customers who only need booking and service operations.
- **Voice**: the existing product in `C:\Users\Blurok\Documents\voice-platform`, which remains separately purchasable.
- **Premium Operations Suite**: Booking + Voice with shared identity, entitlements, AI phone booking, unified timeline, missed-call recovery, call attribution, reminders, and cross-product analytics.

Booking must not depend on Voice. Voice and Booking keep separate sources of truth and integrate using versioned provider APIs and durable events. Never introduce dual writes.

Booking owns customers, booking subjects, services, resources, capabilities, availability, bookings, packages, fulfillment, and outcomes. Voice owns telephony, queues, calls, recordings, transcripts, AI turns, callbacks, and call quality.

The long-term lifecycle is:

`Discover -> Book -> Pay -> Prepare -> Arrive -> Deliver -> Record Outcome -> Follow Up -> Rebook`

## Universal platform and Industry Packs

Do not build a generic calendar and do not hardcode a Driving School application.

Create universal scheduling and service-delivery primitives. Industry Packs compose them into specialized products by declaring terminology, accents, navigation, dashboards, resource/service templates, workflows, forms, outcomes, permissions, reports, and automations.

Driving School is the first deep pack. Dental and Salon are mandatory architecture fixtures. Keep Medical, Fitness, Education, Automotive, and Professional Services in mind when naming and designing extension points.

Industry Packs may specialize the product but may not fork the core application or bypass its invariants.

## Experience direction

Booking must look distinct from the dark phone-console style of Voice while remaining recognizably in the NOVA family.

Use:

- Obsidian `#111827` for the compact sidebar and high-emphasis structure;
- Emerald `#10B981` for primary actions, active states, selected booking slots, focus, and positive progress;
- Deep Emerald `#047857` and Mint `#D1FAE5` for interaction states;
- warm canvas `#F7F8F6`, white cards, charcoal text, and soft gray borders;
- Hanken Grotesk only;
- an 8px spacing rhythm, restrained typography, approximately 16px radii, and minimum 48px touch targets.

Industry colors are secondary contextual accents only: Driving School amber, Dental cyan, Salon rose, Medical teal, Fitness orange, Education sky, Automotive blue, and Professional Services emerald. Primary actions remain emerald and semantic status colors stay stable.

Dark mode must be first-class: avoid pure black; use `#090E1A`, `#111827`, `#172033`, and `#253044` with accessible text contrast.

Use real data and explicit loading, empty, error, offline/retry, denied, and success states. Verify desktop, tablet, mobile, keyboard navigation, contrast, and reduced motion.

## Shared identity and tenant safety

Use the shared NOVA Better Auth service through OAuth 2.1/OIDC Authorization Code + PKCE. The planned issuer is `https://novaauth.niuautomations.com`.

The provider proves identity. This application owns current local organization membership, branch access, roles, permissions, entitlements, row-level isolation, and audit decisions. Resolve identity by `(issuer, subject)`. Never authorize solely from email, an organization claim, an ID token, or a request-body tenant ID. Never put confidential client secrets in browser or mobile clients. Keep machine credentials separate and narrowly scoped.

## Engineering contract

- Always build to verify. A feature is incomplete until relevant static, unit, integration, concurrency, contract, browser, responsive, accessibility, and operational checks pass.
- Never knowingly leave the build, typecheck, lint, migrations, or tests broken.
- Keep authored source files at approximately 300 lines or fewer. Split them into focused components, domain services, adapters, hooks, utilities, and shared modules before they grow oversized. Generated code and documentation are exempt.
- Prefer a modular monolith with strict boundaries and an outbox before microservices.
- Keep deterministic domain logic separate from UI, HTTP, providers, and persistence.
- Validate all external inputs and use typed, versioned contracts.
- Use database constraints and transactions for concurrent scheduling invariants.
- Make externally retried mutations idempotent and auditable.
- Do not let AI invent availability, bypass policy, or directly mutate canonical schedules. AI may interpret intent and rank deterministic valid choices.
- Add a short ownership comment to source files and explain non-obvious constraints.
- Update documentation, traceability, and the graph when architecture or contracts change.
- Before declaring any feature complete, update `docs/FEATURE_SURFACE_MATRIX.md` and check both directions: required user-facing backend capabilities have real frontend workflows, and frontend controls have real backend contracts. Classify legitimate machine/internal endpoints instead of inventing UI for them.

## How to proceed

Do not jump directly into broad application implementation.

1. Audit the current planning artifacts and the existing Voice appointment implementation.
2. Query the knowledge graph for boundaries, risks, missing decisions, and dependencies.
3. Present a concise decision brief for the unresolved items in section 14 of `MASTER_EXECUTION_PLAN.md`, recommending defaults and explaining tradeoffs.
4. Turn accepted decisions into ADRs and an executable, dependency-ordered milestone backlog with acceptance tests.
5. Build one thin walking skeleton: shared sign-in -> local tenant admission -> responsive Booking shell -> one real server-backed state -> verified tests.
6. Expand vertically through the universal scheduling lifecycle before widening feature count.

At every step, protect standalone affordability, premium upgradeability, tenant safety, universal core semantics, industry specialization, and the Obsidian/Emerald experience.

---
