---
name: booking-design
description: Design, critique, and implement Booking product interfaces using the compact NOVA operations system. Use for Booking dashboards, calendars, customer and service management, public booking flows, QR/feedback pages, responsive shell work, and visual comparisons against supplied references.
---

# Booking Design Skill

Use this skill for every material Booking UI change. The target is a calm,
compact service-operations product: white navigation and workspace surfaces,
Niu Booking blue actions, precise Hanken Grotesk typography, and data-honest
states. Booking is distinct from NOVA Voice: it should feel warm and
operational rather than dark, technical, or telephony-console-like.

## External design-skill stack

The local Booking rules are authoritative. External skills are focused lenses,
not competing design systems:

1. Use Anthropic `frontend-design` and Taste `design-taste-frontend` to choose
   a purposeful direction from the product brief before writing markup. Use
   Taste `redesign-existing-projects` when improving an existing route.
2. Use Impeccable after implementation for visual hierarchy, typography,
   spacing, responsive, accessibility, content, and state audits. Its findings
   must be reconciled with Booking tokens and real API contracts.
3. Use Emil `emil-design-eng` for component craft. Invoke `animate` only for a
   named interaction; use `review-animations` or `improve-animations` to audit
   motion. Respect reduced motion and the Booking 140–180ms baseline.
4. The approved web target is Next.js App Router + React + TypeScript. Use the
   shadcn skill/MCP after `components.json` is established for that app. Legacy
   HTML is a migration bridge only; do not add new product pages there or create
   a second token system.

When lenses disagree, preserve this order: product truth and permissions,
Booking tokens, accessibility/responsive requirements, then aesthetic polish.

### Trigger map

- New route or visual world: state Taste's one-line “Design Read”, then use
  `frontend-design` to make the direction specific before coding.
- Existing route: use `redesign-existing-projects`, then Impeccable `critique`
  and `audit` after the first render; use `polish` once for the final pass.
- Animation: use Emil `animate` only for a named interaction; use
  `review-animations` for one component and `improve-animations` for a
  codebase-wide motion audit.
- shadcn: confirm `components.json`, run `shadcn info`, search/view and
  `shadcn docs` before adding; preview updates with `--dry-run`/`--diff` and
  inspect every generated file.
- Do not invoke visual skills for backend-only changes. Finish each route with
  real states, screenshots/browser checks, accessibility, reduced motion,
  focused tests, and the backend/frontend parity audit.

## Workflow

1. Read `PROJECT_CONTEXT.md`, `MASTER_EXECUTION_PLAN.md`, and
   `docs/DESIGN_SYSTEM.md` before changing a shared surface.
2. Inspect the route, shared CSS/components, contracts, API capability, tests,
   current Git state, and `graphify-out/graph.json` when present.
3. Inspect the supplied reference at its real dimensions. Extract hierarchy,
   density, alignment, contrast, and interaction patterns; never copy fake
   metrics, names, appointments, or industry assumptions.
4. State deliberate deviations before implementation. Add real-data,
   permission, offline, and responsive states instead of reproducing a static mock.
5. Build desktop first, then explicitly implement tablet and narrow mobile.
   Keep source files near 300 lines by splitting responsibilities.
6. Re-critique the rendered result against the reference and verify typography,
   spacing, baseline alignment, control sizes, focus, keyboard behavior, and
   reduced motion.
   7. Run formatting, lint, strict typecheck, focused tests, production build,
   browser/smoke checks, and Graphify/Obsidian updates for durable changes.
   Use the Impeccable and Emil review lenses before declaring a visual route
   complete.

## Visual system

### Tokens

- Use Hanken Grotesk everywhere; do not introduce a second product font.
- Canvas `#F7F9FD`; cards `#FFFFFF`; primary text `#171717`; secondary text
  `#64748B`; border `#E5E7EB`.
- Rail and workspace `#FFFFFF`; rail text `#334155`; inactive items use a
  lighter slate; active navigation uses Booking blue on a pale blue surface.
- Primary action/selected slot Booking blue `#140BA7`; deep action `#0D0778`;
  blue surface `#E9E8FB` and icon surface `#C2D2FF`.
- Semantic states: warning `#F59E0B`, danger `#EF4444`, info `#0EA5E9`.
- Industry accents supplement the system only: Driving amber, Dental aqua,
  Medical teal, Salon rose, Fitness orange, Education sky, Automotive blue.
  Never recolor the whole shell or primary action by industry.

### Illustrations

- Use `docs/ILLUSTRATION_CATALOG.md` and the typed
  `BookingIllustration` component for approved SVG artwork.
- Select by task and state, not by filename. One illustration may support a
  public, empty, onboarding, confirmation, help, or recovery state.
- Keep illustrations out of dense calendars, tables, alerts, and regulated
  decisions. Preserve source artwork, write explicit alt text, and do not add
  remote or arbitrary assets inside a route.

### Density

- Use an 8px rhythm: 8, 16, 24, 32, 40, 48.
- Desktop rail: approximately 208–224px; rail header and body header normally
  share a deliberate 64–72px baseline.
- Page title: 24–30px, weight 400, tight tracking. Section title: 18–22px,
  weight 400–500. Body: 14–16px. Labels: 12–13px. Eyebrow: 10–11px,
  medium and restrained.
- Primary controls are at least 48px high; icon controls at least 40px with
  visible focus. Cards use approximately 12–16px radius.
- Prefer borders and quiet tonal shadows over gradients, glassmorphism, or
  oversized hero text.

## Shell and navigation

- Use a white desktop rail and a visible top bar/drawer trigger on mobile; never
  leave navigation silently off-canvas.
- Use consistent 16–18px stroke icons. Icons support labels and do not replace
  desktop labels. Active navigation uses a quiet Booking-blue tonal surface or
  inset accent, not a heavy border or glow.
- Header utility actions are restrained: search, notifications, account, and
  connection state. Red indicators represent actual attention only.
- Primary actions use a clear verb and compact icon: `+ New booking`,
  `Continue`, `Save`, `Confirm`.
- Pack navigation, labels, ordering, widgets, and contextual icons come from a
  pack registry rather than hard-coded Driving School/Dental assumptions.

## Page patterns

### Dashboard

Lead with date/context, next useful action, exceptions, and schedule. Do not
lead with decorative metrics. An empty workspace explains why it is empty and
offers the next authorized action: sign in, select organization/branch,
configure services, or connect data.

### Calendar

Treat the calendar as an allocation surface. Preserve staff, resource,
location, conflict, hold, buffer, travel, maintenance, and unavailable context.
Use icons/patterns in addition to color. Clicking a booking opens a
URL-addressable detail drawer or page; never hide important detail in hover-only UI.

### Customers, services, and profiles

Keep the universal identity header, primary action, summary, tabs, and activity
timeline stable. Packs add typed contextual panels through a registry. Group
fields by user task, keep labels visible, and make validation/pending/success
states explicit.

### Public booking and supporting tools

Use mobile-first progressive disclosure: service, branch, feasible slot,
customer details, consent, deposit/payment boundary, and confirmation. QR Print
Studio must show the authorized destination, print-safe preview, and explicit
not-selected/diagnostic states. Feedback and communications distinguish
configuration, pending delivery, expired links, and response data.

## Data and state rules

Every user-facing capability defines loading, empty/unconfigured, no-results,
validation error, server error, offline/degraded, permission-denied, pending,
success, and destructive-confirmation behavior where applicable.

- Never invent customers, bookings, revenue, availability, staff, capacity,
  dates, or percentages to make a dashboard look complete.
- Identity tokens prove identity only; local membership, branch scope, permissions,
  and entitlements control what the UI can show or mutate.
- Do not add controls with no real contract. Deferred capabilities show a truthful
  unavailable/configuration state and record owner, reason, phase, and acceptance.
- Keep sensitive customer/industry details subordinate and permission-aware.

## Responsive and accessibility

- Check desktop, tablet, narrow mobile, zoom, long names, translated labels,
  keyboard-only operation, visible `:focus-visible`, and reduced motion.
- At narrow widths, convert rails to a top bar/drawer, stack title/action rows,
  and keep primary actions reachable without horizontal scrolling.
- Do not allow critical headings, status labels, or action text to wrap
  accidentally when a smaller type size or stacked layout solves it.
- Use semantic links/buttons, labelled icon-only controls, sufficient contrast,
  and 48px primary touch targets.
- Nonessential motion is 140–180ms and disabled under
  `prefers-reduced-motion: reduce`.

## Reference critique checklist

Compare the rendered page against the reference for font family, title size and
weight, tracking, line height, rail width, header height, baseline alignment,
menu density, title/action spacing, card radius, border/shadow restraint, icon
optical size, active/hover/focus behavior, truthful state handling, and mobile
drawer behavior. Preserve reference details only when they improve Booking
clarity; document deliberate deviations in an ADR or page review note.

## Completion gate

- [ ] Route, contracts, reference, and pack context inspected.
- [ ] Hanken Grotesk and Booking tokens used consistently.
- [ ] Desktop, tablet, mobile, keyboard, focus, zoom, and reduced-motion states checked.
- [ ] Real data plus loading/empty/error/offline/permission/pending/success states implemented.
- [ ] Lint, typecheck, focused tests, production build, and browser smoke checks pass.
- [ ] `docs/DESIGN_SYSTEM.md`, Graphify, and planning/ADR notes updated when durable rules change.
