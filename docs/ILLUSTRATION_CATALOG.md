# Booking illustration catalog

The Booking web app uses a small, intentional illustration system. Supplied
unDraw SVGs live in `apps/web/public/illustrations/` and are selected through
the typed catalog at `apps/web/app/lib/illustrations.ts`. Routes should choose
an illustration by the user's task, never by reaching directly for a filename.

## Selection rules

- Use one illustration as a supporting signal, not as the page's main content.
- Keep illustrations on public, empty, onboarding, confirmation, help, and
  recovery surfaces; do not place them inside dense tables, calendars, alerts,
  or regulated decision states.
- Keep the art on a white or Booking-blue-soft surface with generous breathing
  room. Do not recolor the source SVGs with CSS filters or mix illustration
  accent colors into status semantics.
- Informative artwork gets concise alt text. Decorative artwork uses `alt=""`
  and does not repeat the surrounding copy.
- Prefer a single illustration per state. The current target is roughly
  144–220px wide on desktop and 120–170px on narrow screens.
- Industry packs may select a different approved illustration, but they do not
  introduce arbitrary remote artwork or replace the universal Booking tokens.

## Recommended map

| User situation | Catalog id | Use |
| --- | --- | --- |
| Public product introduction | `booking` | Explain the universal booking model |
| Workspace sign-in gate | `login` | Honest unconnected staff state |
| Calendar overview | `calendar` | Schedule and date-led pages |
| Date/time selection | `datePicker` | Progressive booking steps |
| Classes, trips, and runs | `eventsCalendar` | Occurrence-oriented flows |
| Schedule loading/no results | `schedule` | Waiting for real data |
| Connected integration | `onlineCalendar` | Workspace connection state |
| Booking confirmed | `booked` | Confirmation and success |
| Reminders | `alarmClock` | Communication timing |
| Feedback invitation | `sharingIdeas` | Conversational improvement request |
| Reminder/communication setup | `onlineOrganizer` | Configuration and organization |
| Setup complete | `checkingBoxes` | Honest completion state |
| Permission/access success | `confident` | Continue after admission |
| Schedule cleanup | `scheduleCleanup` | Maintenance and housekeeping |
| Help/recovery | `readingBook` or `relaxedReading` | Guidance without urgency |
| Quiet waiting | `coffeeTime` or `meditation` | Low-pressure recovery only |
| No matching result | `wanderingMind` | Explain a recoverable empty result |
| Professional Services pack | `freelancer` | Pack-specific context |
| Optional profile context | `coolGirlAvatar` or `chillGuyAvatar` | Never imply identity or role |
| Internal developer documentation | `vibeCoding` | Do not use in customer-facing flows |

## Current implementation

The public home uses `booking` and the staff workspace's unconnected state uses
`login`. New pages should import `BookingIllustration` and pass an explicit
catalog id and alt text. This keeps future sessions inside the same visual
language and makes a design choice reviewable in one place.
