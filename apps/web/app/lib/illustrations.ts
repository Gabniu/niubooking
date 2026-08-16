// Ownership: approved Booking illustration catalog; routes choose by intent, not filename.
export type BookingIllustrationId = keyof typeof bookingIllustrations;

type IllustrationSpec = {
  readonly file: string;
  readonly defaultAlt: string;
  readonly bestFor: string;
};

export const bookingIllustrations = {
  alarmClock: { file: "alarm-clock.svg", defaultAlt: "A clock ready for a reminder", bestFor: "reminders and upcoming actions" },
  booked: { file: "booked.svg", defaultAlt: "A confirmed booking", bestFor: "booking confirmation and success" },
  booking: { file: "booking.svg", defaultAlt: "A person arranging a booking", bestFor: "public product introduction and booking entry" },
  calendar: { file: "calendar.svg", defaultAlt: "A calendar with scheduled dates", bestFor: "calendar and schedule overview" },
  checkingBoxes: { file: "checking-boxes.svg", defaultAlt: "A person checking completed tasks", bestFor: "setup, configuration, and completion" },
  confident: { file: "confident.svg", defaultAlt: "A confident person ready to continue", bestFor: "permission, access, and onboarding success" },
  coffeeTime: { file: "coffee-time.svg", defaultAlt: "A person taking a quiet break", bestFor: "low-pressure waiting and recovery states" },
  coolGirlAvatar: { file: "cool-girl-avatar.svg", defaultAlt: "A friendly profile avatar", bestFor: "optional profile and people contexts" },
  chillGuyAvatar: { file: "chill-guy-avatar.svg", defaultAlt: "A relaxed profile avatar", bestFor: "optional profile and people contexts" },
  datePicker: { file: "date-picker.svg", defaultAlt: "A person choosing a date", bestFor: "date and time selection" },
  eventsCalendar: { file: "events-calendar.svg", defaultAlt: "A calendar of events", bestFor: "occurrences, classes, and trips" },
  freelancer: { file: "freelancer.svg", defaultAlt: "A person working independently", bestFor: "professional-services pack context" },
  login: { file: "login.svg", defaultAlt: "A person signing in", bestFor: "workspace access and authentication empty states" },
  meditation: { file: "meditation.svg", defaultAlt: "A person in a calm pause", bestFor: "quiet empty or recovery states" },
  nature: { file: "nature.svg", defaultAlt: "A calm nature scene", bestFor: "quiet public or recovery states" },
  onlineCalendar: { file: "online-calendar.svg", defaultAlt: "A calendar connected online", bestFor: "connected workspace and integration states" },
  onlineOrganizer: { file: "online-organizer.svg", defaultAlt: "A person organizing a calendar", bestFor: "communications, reminders, and organization" },
  readingBook: { file: "reading-a-book.svg", defaultAlt: "A person reading", bestFor: "help, guidance, and low-pressure empty states" },
  relaxedReading: { file: "relaxed-reading.svg", defaultAlt: "A person reading comfortably", bestFor: "help, guidance, and recovery states" },
  schedule: { file: "schedule.svg", defaultAlt: "A person reviewing a schedule", bestFor: "schedule loading and no-results states" },
  scheduleCleanup: { file: "schedule-cleanup.svg", defaultAlt: "A person tidying a schedule", bestFor: "schedule cleanup and maintenance" },
  sharingIdeas: { file: "sharing-ideas.svg", defaultAlt: "People sharing ideas", bestFor: "feedback and improvement invitations" },
  vibeCoding: { file: "vibe-coding.svg", defaultAlt: "A person working at a computer", bestFor: "internal developer or integration documentation only" },
  wanderingMind: { file: "wandering-mind.svg", defaultAlt: "A person thinking", bestFor: "no-results or paused-work explanations" },
} as const satisfies Record<string, IllustrationSpec>;

export function illustrationSrc(id: BookingIllustrationId): string {
  return `/illustrations/${bookingIllustrations[id].file}`;
}
