# Niu Booking frontend operating memory

Read `AGENTS.md`, `PROJECT_CONTEXT.md`, `MASTER_EXECUTION_PLAN.md`,
`docs/DESIGN_SYSTEM.md`, and `docs/skills/booking-design/SKILL.md` before a
material change. The local Booking skill is authoritative for product truth,
tokens, accessibility, responsive behavior, and backend/frontend parity.

## Design-lens order

1. Anthropic `frontend-design` and Taste choose a purposeful direction from the
   brief; Taste `redesign-existing-projects` audits existing screens.
2. Impeccable audits hierarchy, typography, spacing, content, accessibility,
   responsive behavior, and state completeness after implementation.
3. Emil `emil-design-eng` guides component craft. Use `animate` for a named
   interaction and the animation review skills for motion audits.
4. The approved web target is Next.js App Router + React + TypeScript. shadcn
   skill/MCP becomes implementation-ready once `components.json` is added;
   legacy HTML is migration-only and receives no new product pages.

Resolve disagreements in this order: real contracts and permissions, Booking
tokens, accessibility/responsive requirements, then visual polish.

## Trigger-to-workflow map

- New page: state Taste's one-line Design Read, use `frontend-design` for the
  direction, then implement real route states.
- Existing page: use `redesign-existing-projects`, then Impeccable `critique` and
  `audit`; use `polish` once after the fixes.
- Animation: use Emil `animate` only for a named interaction; use the review
  skills for existing motion.
- shadcn: confirm `components.json`, run `info`, search/view and `docs` before
  adding; preview updates with `--dry-run`/`--diff` and inspect generated files.
- Do not invoke visual skills for backend-only changes; always finish with
  screenshot/browser, accessibility, reduced-motion, tests, and parity checks.

## Current Booking visual contract

- Hanken Grotesk; compact 8px rhythm; page titles 24–30px, regular weight.
- White rail and workspace; Booking blue `#140BA7`, deep blue `#0D0778`, soft
  surface `#E9E8FB`, icon surface `#C2D2FF`.
- Emerald is semantic success/context, not the primary shell action color.
- No placeholder production data. Every route has loading, empty, error,
  offline/degraded, permission, pending, success, and responsive states.

## Completion

Replace placeholder HTML with real route components and typed contracts in
small batches. Keep source files at or below 300 lines, test each batch, run the
backend-to-frontend surface audit, and update Graphify when relationships or
durable design rules change. Review desktop, tablet, mobile, keyboard focus,
zoom, and reduced motion before shipping.
