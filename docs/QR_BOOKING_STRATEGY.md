# QR Booking Strategy

## Product role

QR booking is a first-class customer acquisition surface for Booking-only and Premium customers. A business can print a code on a storefront, vehicle, reception desk, business card, lesson handout, treatment instruction, receipt, or campaign material. Scanning it opens the same canonical public booking journey without requiring Voice or a customer account.

## Universal model

```text
QR Code -> safe public URL -> opaque destination -> tenant/branch/pack context
        -> public availability -> hold -> verification -> confirmation
```

A destination may target an organization or branch, service/category, Industry Pack context, permitted resource/location preference, campaign/source, or locale. It never exposes internal IDs, customer data, credentials, bearer tokens, secrets, or arbitrary redirect URLs.

## URL and destination rules

- Use a stable route such as `/book/{publicCode}`.
- `publicCode` is opaque, non-sequential, and safe to print.
- Resolution validates status, tenant, branch, pack version, destination policy, and expiry.
- Destinations are pausable and revocable without deleting historical bookings or analytics.
- Safe edits preserve the public code when possible so printed material does not break unexpectedly.
- Unknown, paused, or expired codes render a helpful generic state and never redirect to an untrusted URL.
- Attribution is separate from the destination code and survives the booking lifecycle.

## Customer experience

- Mobile-first scan landing page with clear business, branch, service, and next action.
- Guest booking remains available; preselected context is visible and changeable where policy allows.
- Deep links work from camera apps and in-app browsers.
- Loading, no availability, invalid/expired, offline, error, and confirmation states are explicit.
- Booking never requests camera permission; the device scanner opens the URL.

## Staff experience

- Authorized staff can create, preview, pause, revoke, rotate, and download destinations.
- Print-friendly SVG/PNG/PDF assets include quiet-zone, size, contrast, and error-correction guidance.
- Management shows target, status, creator, last-used, scan count, booking count, and safe attribution summaries.
- A destination must be testable before publishing and discoverable in public-booking/marketing operations.

## Print Studio direction

The existing `C:\Users\Blurok\Documents\qr-survey` Print Studio is a workflow reference, not a visual or code dependency. Borrow its useful authoring model—template cards, variant selection, live preview, editable copy, logo/accent controls, high-resolution export, direct print, and scan diagnostics—while keeping Booking's Hanken Grotesk, Obsidian/Emerald, and warm-neutral design system.

- Provide typed templates for table tents, stickers, A5 flyers, and A4 posters, with industry-safe variants such as Hero, Split, and Classic.
- Let authorized staff edit headline, CTA, business/branch label, logo, and a constrained accent color; never accept arbitrary tenant HTML or CSS.
- Preview the actual destination and selected physical size before export. Print output removes admin chrome and supports SVG, PNG, and PDF.
- Preserve scan reliability after branding customization: white background, strong contrast, quiet zone of at least 4mm, minimum physical size, and appropriate error correction.
- Allow logo overlays only when diagnostics pass and high error correction is selected. Show a clear scan-test result before publishing.
- Keep template metadata in a typed registry so industry packs can add labels and safe variants without forking the QR resolver.

## Security, privacy, and integration

- Resolution is rate-limited, observable, and tenant-isolated.
- A QR grants no staff access and cannot bypass verification, consent, payment, package, availability, or scheduling rules.
- Aggregate attribution counters are preferred; raw device fingerprints are not stored by default.
- Invalid/paused/unknown responses are externally generic to prevent enumeration.
- Mutation is permissioned, idempotent, CSRF/session protected, and audited.
- Booking owns QR resolution and attribution. Voice may consume `booking.attributed` events but never becomes a second QR or booking source of truth.

## Industry examples

| Pack | QR destinations |
|---|---|
| Driving School | branch, introductory lesson, campaign/source |
| Dental | branch, new-patient consultation, treatment category, emergency guidance |
| Salon | branch, service category, stylist preference, repeat-booking campaign |

The resolver is universal; packs contribute labels, defaults, panels, and allowed templates.

## Verification scenarios

1. A Booking-only tenant creates a branch/service QR and completes a mobile public booking.
2. Opaque codes reveal no tenant, service, customer, or database IDs.
3. Paused, revoked, expired, and unknown codes show safe recoverable states.
4. A destination cannot cross tenant or branch scope.
5. Context survives search, hold, confirmation, reminder, and attribution events.
6. QR cannot bypass consent, package, payment, capacity, or availability rules.
7. Concurrent scans cannot overbook underlying resources.
8. Unauthorized staff cannot create, rotate, download, or revoke codes.
9. Print assets meet quiet-zone, contrast, size, and error-correction guidance.
10. Landing, booking, error, offline, keyboard, zoom, reduced-motion, and mobile states pass.
11. Voice linkage records attribution without another QR or booking source of truth.
