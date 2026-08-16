# Booking Product Design System

## Design objective

Create a calm, compact, premium operating system for service businesses. The product must feel universal at the brand level and specialized at the workflow level.

Booking must not inherit the Voice product's dark phone-console aesthetic. Voice is live, technical, and communications-heavy. Booking is warm, clear, operational, and industry-adaptive.

## Compact NOVA density rule

Authenticated Booking pages follow the NOVA compact visual system: Hanken Grotesk everywhere; page titles at approximately 24–30px with weight 400; section headings at approximately 18–22px with weight 400–500; labels at 12–13px with weight 500; an 8px spacing rhythm; compact centered content rails; restrained shadows; and no oversized hero typography. Touch controls remain at least 44–48px high for accessibility. Empty, loading, denied, and error states must remain visually calm and data-honest.

## Motion rule

Use animation to clarify state and hierarchy: 140–180ms ease transitions for navigation, controls, focus, and schedule-card emphasis; a subtle 1–2px lift is acceptable for hoverable cards; avoid looping or decorative motion. Every nonessential transition must be disabled under `prefers-reduced-motion: reduce`. Motion must never be required to discover a control or understand a status.

## Brand architecture

```text
NOVA family
  Booking — warm operations workspace
  Voice   — dark real-time communications console
```

Shared family traits:

- Hanken Grotesk;
- disciplined typography and spacing;
- clear state communication;
- consistent identity/account controls;
- accessibility and responsive quality;
- restrained, professional motion.

Product identity remains distinct.

## Core light palette

| Token | Value | Use |
|---|---:|---|
| `brand.blue` | `#140BA7` | Primary actions, active booking states |
| `brand.blueDeep` | `#0D0778` | Hover/pressed, strong emphasis |
| `brand.blueSoft` | `#E9E8FB` | Active navigation and selected surfaces |
| `brand.blueIcon` | `#C2D2FF` | Brand and empty-state icon surfaces |
| `canvas` | `#F7F9FD` | Main light workspace |
| `surface` | `#FFFFFF` | Cards, drawers, menus |
| `text.primary` | `#171717` | Main content |
| `text.secondary` | `#64748B` | Metadata and supporting copy |
| `border` | `#E5E7EB` | Structure and dividers |
| `warning` | `#F59E0B` | Attention and warning |
| `danger` | `#EF4444` | Destructive/error |
| `info` | `#0EA5E9` | Informational states |

Booking blue is deliberate, not pervasive. Use it for primary actions, selected
slots, active navigation, links, focus states, and meaningful highlights.
Semantic green remains available for success and positive operational status.

## Illustration language

Booking uses the approved SVG catalog in `docs/ILLUSTRATION_CATALOG.md`. Choose
art by user intent: `booking` for public introduction, `login` for workspace
access, `calendar`/`datePicker` for scheduling, `booked` for confirmation, and
`sharingIdeas` for feedback. Keep illustrations out of dense operational
tables, alerts, and regulated decision states. Use one calm illustration per
state, preserve its source artwork, provide meaningful alt text when it carries
information, and use `alt=""` when the surrounding copy already communicates
the state. The catalog is typed so a future page cannot quietly add an
unapproved remote asset or a second illustration language.

## Voice-only dark palette

These dark tokens belong to the separate Voice console and are not used by the
Booking application shell.

| Token | Value |
|---|---:|
| `canvas` | `#090E1A` |
| `surface` | `#111827` |
| `surfaceRaised` | `#172033` |
| `border` | `#253044` |
| `text.primary` | `#F8FAFC` |
| `text.secondary` | `#94A3B8` |
| `brand.emerald` | `#10B981` |

Avoid pure black. Dense calendars and tables need tonal separation.

## Industry accents

| Industry | Accent | Appropriate uses |
|---|---:|---|
| Driving School | Amber `#F59E0B` | Course progress, vehicles, lesson context |
| Dental | Aqua `#06B6D4` | Treatment, chair, practitioner context |
| Medical | Teal `#0D9488` | Care pathway and clinical context |
| Salon / Beauty | Rose `#E11D48` | Preferences and treatment context |
| Fitness | Orange `#F97316` | Programs, effort, attendance |
| Education | Sky `#0EA5E9` | Courses, learning progress |
| Automotive | Blue `#2563EB` | Vehicle and workshop context |
| Professional Services | Emerald `#059669` | Engagement and delivery context |

Rules:

- Booking blue remains the platform action color. Emerald is reserved for
  success/positive status and pack-specific context where appropriate.
- Industry accents never recolor the entire navigation or primary action system.
- Use accents for domain icons, selected domain views, progress, contextual charts, tags, and pack-specific panels.
- Status colors retain stable semantic meaning across packs.

## Typography and density

- Hanken Grotesk only.
- Page title: 24–32px, regular.
- Section title: 18–22px, regular/medium.
- Body: 14–16px, regular.
- Labels: 12–14px, medium.
- Eyebrow/status: 10–11px, medium, restrained tracking.
- Use an 8px spacing rhythm.
- Primary touch controls are at least 48px high.
- Primary cards/inputs use approximately 16px radius; compact controls use smaller radii.
- Prefer subtle tonal shadows and borders over floating glass panels.

## Shell

- Default desktop sidebar: compact 208px white rail with a subtle divider.
- Main canvas: light NOVA workspace (`#F7F9FD`).
- Header and sidebar brand row share a deliberate baseline and height.
- Active navigation uses Booking blue text/icon on `#E9E8FB`.
- Industry Pack controls labels, visible modules, ordering, and contextual icons.
- Tablet uses a collapsible rail.
- Narrow mobile uses a visible top bar and drawer trigger; navigation is never silently off-canvas.

## Calendar

Calendar is an operational surface, not a decorative grid.

- Support staff, resource, location, capacity, and later map views.
- Use contextual booking cards with service, customer/subject, assigned resources, location, state, and relevant pack detail.
- Preserve keyboard navigation and visible focus.
- Virtualize dense resource columns.
- Show conflicts, holds, travel blocks, maintenance, and unavailable periods with patterns/icons as well as color.
- Clicking a booking opens a URL-addressable right drawer.
- Recommended availability appears before exhaustive availability.

## Profiles and pack composition

Universal profile shell owns:

- identity header;
- primary actions;
- summary rail;
- tabs;
- activity timeline;
- loading/empty/error/permission behavior.

Packs contribute typed panels and tabs through a registry. Driving School may add course progress and lesson assessments; Dental may add care context and recalls. Avoid separate application trees and avoid an untyped dynamic-page renderer.

## Required states

Every feature specifies:

- loading;
- empty/unconfigured;
- no results;
- validation error;
- server error;
- offline/degraded integration;
- permission denied;
- destructive confirmation;
- optimistic/pending action;
- success and undo where appropriate.

Never populate an empty tenant with invented metrics or sample customers in production.

## Prohibited patterns

- generic purple/indigo AI gradients;
- excessive glassmorphism;
- giant hero typography inside operations screens;
- bubbly rounding on every surface;
- fake data used as if real;
- color-only status communication;
- hidden focus states;
- desktop sidebars without a mobile trigger;
- a universal component containing Driving School terminology;
- pack colors replacing semantic status colors.

## Acceptance checklist

- Reference and pack context inspected.
- Universal versus pack-specific ownership stated.
- Desktop, tablet, and narrow mobile rendered and reviewed.
- Keyboard, focus, zoom, long content, and reduced motion checked.
- Loading, empty, error, offline, permission, and success states exercised.
- Contrast and touch targets verified.
- Lint, strict typecheck, build, component tests, and focused browser tests pass.

## Project design skill

Use `docs/skills/booking-design/SKILL.md` for every material Booking interface
change. It packages the NOVA shell rules, Booking-specific page patterns,
real-data state requirements, reference critique checklist, and responsive
accessibility workflow established by ADR-0015.
