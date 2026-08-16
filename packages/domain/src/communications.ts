// Ownership: communication policy primitives. Delivery workers consume these decisions; they do not redefine them.

export type CommunicationChannel = "email" | "sms" | "voice";
export type FeedbackAudience = "any-client" | "completed-appointment" | "campaign";

export interface ReminderRule {
  id: string;
  enabled: boolean;
  minutesBefore: number;
  channels: readonly CommunicationChannel[];
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  frequencyCapHours: number;
}

export interface BookingChangePolicy {
  rescheduleEnabled: boolean;
  cancellationEnabled: boolean;
  minimumNoticeMinutes: number;
}

export const defaultBookingChangePolicy: BookingChangePolicy = {
  rescheduleEnabled: true,
  cancellationEnabled: true,
  minimumNoticeMinutes: 0,
};

export interface CommunicationSettings {
  tenantId: string;
  timezone: string;
  remindersEnabled: boolean;
  feedbackEnabled: boolean;
  reminderRules: readonly ReminderRule[];
  defaultFeedbackFrequencyDays: number;
  bookingChangePolicy: BookingChangePolicy;
}

export interface FeedbackCampaign {
  id: string;
  tenantId: string;
  enabled: boolean;
  audience: FeedbackAudience;
  templateVersion: number;
  frequencyCapDays: number;
  expiresAfterDays: number;
}

export interface FeedbackEligibilityInput {
  campaign: FeedbackCampaign;
  hasCompletedAppointment: boolean;
  optedOut: boolean;
  lastSentAt: Date | null;
  now: Date;
}

export function isFeedbackEligible(input: FeedbackEligibilityInput): boolean {
  if (!input.campaign.enabled || input.optedOut) return false;
  if (input.campaign.audience === "completed-appointment" && !input.hasCompletedAppointment) return false;
  if (!input.lastSentAt) return true;
  const elapsedDays = (input.now.getTime() - input.lastSentAt.getTime()) / 86_400_000;
  return elapsedDays >= input.campaign.frequencyCapDays;
}

export function reminderAt(appointmentStart: Date, rule: ReminderRule): Date {
  if (rule.minutesBefore <= 0) throw new Error("Reminder offset must be positive");
  return new Date(appointmentStart.getTime() - rule.minutesBefore * 60_000);
}

export function validateBookingChangePolicy(policy: BookingChangePolicy): void {
  if (!Number.isInteger(policy.minimumNoticeMinutes) || policy.minimumNoticeMinutes < 0 || policy.minimumNoticeMinutes > 43_200) throw new Error("Minimum booking change notice must be between 0 and 30 days.");
}

export function bookingChangeAllowed(policy: BookingChangePolicy, action: "reschedule" | "cancel", startsAt: Date, now = new Date()): boolean {
  validateBookingChangePolicy(policy);
  if (action === "reschedule" ? !policy.rescheduleEnabled : !policy.cancellationEnabled) return false;
  return startsAt.getTime() - now.getTime() >= policy.minimumNoticeMinutes * 60_000;
}
