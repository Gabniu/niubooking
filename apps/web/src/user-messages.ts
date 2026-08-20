// Ownership: translate API diagnostics into calm, actionable interface copy.

export interface ApiErrorLike { code?: string; message?: string; }

const known: Record<string, string> = {
  UNAUTHENTICATED: "Please sign in to continue.",
  WORKSPACES_UNAVAILABLE: "Your workspaces are temporarily unavailable. Please try again.",
  TENANT_ACCESS_DENIED: "You do not have access to this workspace.",
  AVAILABILITY_INVALID: "Please choose a valid time window.",
  AVAILABILITY_UNAVAILABLE: "Availability is temporarily unavailable. Please try again.",
  BOOKING_INVALID: "Please check the appointment details and try again.",
  BOOKING_NOT_FOUND: "That appointment could not be found.",
  BOOKINGS_UNAVAILABLE: "Appointments are temporarily unavailable. Please try again.",
  BOOKING_HOLD_EXPIRED: "That time is no longer held. Please choose another time.",
  BOOKING_HOLD_INVALID: "That booking hold is no longer valid. Please start again.",
  BOOKING_CONFLICT: "Sorry, that time was just taken. Please choose another time.",
  CUSTOMER_INVALID: "Please check the customer details and try again.",
  CUSTOMER_NOT_FOUND: "That customer could not be found.",
  CUSTOMERS_UNAVAILABLE: "Customer profiles are temporarily unavailable. Please try again.",
  CONTACTS_UNAVAILABLE: "Contact methods are temporarily unavailable. Please try again.",
  SERVICES_UNAVAILABLE: "Services are temporarily unavailable. Please try again.",
  SERVICE_NOT_FOUND: "That service could not be found.",
  SERVICE_INVALID: "Please check the service details and try again.",
  RESOURCES_UNAVAILABLE: "Resources are temporarily unavailable. Please try again.",
  RESOURCE_INVALID: "Please check the resource details and try again.",
  OCCURRENCES_UNAVAILABLE: "Sessions are temporarily unavailable. Please try again.",
  OCCURRENCE_INVALID: "Please check the session details and try again.",
  RESERVATIONS_UNAVAILABLE: "Reservations are temporarily unavailable. Please try again.",
  PACKS_UNAVAILABLE: "Industry options are temporarily unavailable. Please try again.",
  PACK_INVALID: "Please check the industry settings and try again.",
  PACK_NOT_FOUND: "That industry option could not be found.",
  PACK_SETTINGS_UNAVAILABLE: "Industry settings are temporarily unavailable. Please try again.",
  FEEDBACK_ADMIN_UNAVAILABLE: "Feedback settings are temporarily unavailable. Please try again.",
  FEEDBACK_REPORTING_UNAVAILABLE: "Feedback insights are temporarily unavailable. Please try again.",
  QR_NOT_FOUND: "This booking link could not be found. Check the link and try again.",
  QR_INACTIVE: "This booking link is not active.",
  QR_EXPIRED: "This booking link has expired.",
  QR_INVALID: "Please check the booking link details and try again.",
  FEEDBACK_EXPIRED: "This feedback link has expired.",
  FEEDBACK_USED: "This feedback has already been submitted. Thank you.",
  FEEDBACK_NOT_FOUND: "This feedback link could not be found.",
  FEEDBACK_INVALID: "Please check the feedback and try again.",
  CONTACT_VERIFICATION_INVALID: "That code is not correct. Check your message and try again.",
  CONTACT_VERIFICATION_EXPIRED: "That code has expired. Request a new code.",
  CONTACT_VERIFICATION_LOCKED: "Too many attempts. Request a new code later.",
  OCCURRENCE_FULL: "That session is full. Please choose another one.",
  RESERVATION_CONFLICT: "That place was just taken. Please choose another one.",
  TRANSPORT_UNAVAILABLE: "Transport booking is temporarily unavailable. Please try again.",
  TRANSPORT_TRIP_INVALID: "Please choose a valid travel date.",
  TRANSPORT_RESERVATION_INVALID: "Please check your passenger and stop details and try again.",
  TRANSPORT_CAPACITY_FULL: "That trip is full. Please choose another trip.",
  TRANSPORT_CANCELLATION_INVALID: "This cancellation link is not valid.",
  TRANSPORT_RESERVATION_NOT_FOUND: "This reservation link is no longer available.",
  TRANSPORT_CANCELLATION_CONFLICT: "This reservation cannot be cancelled now.",
  TRANSPORT_ROUTE_INVALID: "Please check the route details and ordered stops.",
  TRANSPORT_CAPACITY_CONFLICT: "That passenger change is not available.",
  TRANSPORT_BOARDING_INVALID: "Please check the boarding action and try again.",
  TRANSPORT_BOARDING_CONFLICT: "This ticket cannot be boarded now.",
  TRANSPORT_SEAT_INVALID: "Please choose one valid seat for each passenger.",
  TRANSPORT_SEAT_CONFLICT: "One of those seats was just taken. Please choose different seats.",
  FLEET_ACCESS_DENIED: "You do not have access to these live vehicle locations.",
  LIVE_FLEET_UNAVAILABLE: "Live vehicle locations are temporarily unavailable. Please try again.",
  TRACKING_SESSION_INACTIVE: "No active tracking session was found for this trip.",
  MANAGE_NOT_FOUND: "This appointment link could not be found.",
  MANAGE_INVALID: "This appointment link is no longer valid.",
};

export function userFacingMessage(status: number, error: ApiErrorLike | null | undefined, fallback: string): string {
  const codeMessage = error?.code ? known[error.code] : undefined;
  if (codeMessage) return codeMessage;
  if (status === 401) return "Please sign in to continue.";
  if (status === 403) return "You do not have access to this workspace.";
  if (status === 404) return "We could not find what you requested.";
  if (status === 409) return "That change conflicts with an update already made. Refresh and try again.";
  if (status >= 500) return `${fallback} Please try again.`;
  return fallback;
}
