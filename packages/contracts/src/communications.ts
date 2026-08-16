// Ownership: versioned communication contracts shared by organization settings, workers, and UI.

import type { BookingChangePolicy, CommunicationChannel, FeedbackAudience } from "@bookingapp/domain";

export interface CommunicationSettings {
  tenantId: string;
  timezone: string;
  remindersEnabled: boolean;
  feedbackEnabled: boolean;
  reminderRules: readonly { id: string; enabled: boolean; minutesBefore: number; channels: readonly CommunicationChannel[]; quietHoursStart: string | null; quietHoursEnd: string | null; frequencyCapHours: number }[];
  defaultFeedbackFrequencyDays: number;
  bookingChangePolicy: BookingChangePolicy;
}

export interface CommunicationSettingsResponse {
  data: CommunicationSettings | null;
  error: { code: "UNAUTHENTICATED" | "TENANT_ACCESS_DENIED"; message: string } | null;
}

export interface FeedbackCampaignSummary {
  id: string;
  tenantId: string;
  enabled: boolean;
  audience: FeedbackAudience;
  templateVersion: number;
  frequencyCapDays: number;
  expiresAfterDays: number;
}

export type ContactConsentStatus = "granted" | "denied" | "unknown";
export interface CustomerContactMethodSummary { id: string; customerId: string; customerName: string | null; channel: CommunicationChannel; maskedDestination: string; consentStatus: ContactConsentStatus; verifiedAt: string | null; enabled: boolean; priority: number; }
export interface CustomerContactMethodResponse { data: readonly CustomerContactMethodSummary[] | null; error: { code: "UNAUTHENTICATED" | "TENANT_ACCESS_DENIED" | "CONTACTS_UNAVAILABLE"; message: string } | null; }
export interface ContactVerificationChallenge { challengeId: string; expiresAt: string; }
export interface ContactVerificationResponse { data: { verified: boolean } | null; error: { code: "CONTACT_VERIFICATION_INVALID" | "CONTACT_VERIFICATION_EXPIRED" | "CONTACT_VERIFICATION_LOCKED" | "CONTACTS_UNAVAILABLE"; message: string } | null; }
