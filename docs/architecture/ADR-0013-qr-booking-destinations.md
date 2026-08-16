---
id: ADR-0013
title: Secure QR Booking Destinations
status: proposed
date: 2026-08-12
requirements: [REQ-QR-001, REQ-QR-002]
tests: [TEST-QR-001, TEST-QR-002]
risks: [RISK-QR-ABUSE-001, RISK-QR-REDIRECT-001]
---

# Decision

Booking provides QR destinations as opaque, revocable public entry points into the canonical public booking flow. The public route is `/book/{publicCode}`. A destination resolves to tenant/branch/pack context and optional service, resource, locale, and campaign metadata.

QR codes contain no internal IDs, PII, bearer tokens, secrets, or arbitrary redirect URLs. Resolution is tenant-safe, policy-aware, rate-limited, and externally generic for invalid/paused/unknown states. Destination mutation is permissioned, idempotent, and audited.

QR works for Booking-only tenants. Premium Suite may add Voice attribution and follow-up analytics through versioned events; Voice does not become a QR or booking source of truth.

The existing qr-survey Print Studio is used only as a product-workflow reference. Its template/variant chooser, live preview, editable headline and subtext, logo and accent controls, high-resolution asset generation, direct print mode, and quiet-zone diagnostics are valuable patterns. Booking does not copy its Flask routes, survey terminology, typography, or gold/glass visual identity; Booking uses Hanken Grotesk with Obsidian, Emerald, and warm neutrals.

# Acceptance

- A printed QR opens a mobile-first public flow and completes a booking through normal availability and hold invariants.
- Pause, revoke, and expiry are safe, observable, and recoverable.
- Context and attribution survive the full booking lifecycle.
- Cross-tenant resolution, enumeration, arbitrary redirects, and policy bypasses fail closed.
- Admin create/preview/download/rotate/revoke actions obey permissions and audit rules.
- Print assets and narrow-mobile states pass accessibility and visual review.
- Print templates (table tent, sticker, flyer, poster) preserve quiet zone, minimum physical size, contrast, and error-correction constraints after safe branding customization.
- Logo overlays are permitted only when scan diagnostics pass; output is available as print-safe SVG/PNG/PDF with admin chrome removed.

# Consequences

Print Studio becomes a typed template registry and shared export/diagnostic service. Industry packs contribute labels and approved variants; they cannot inject arbitrary markup or weaken QR safety constraints.
