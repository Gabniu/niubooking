// Ownership: API composition boundary. Runtime secrets are validated once and never exposed to handlers.

import type { Pool } from "pg";
import { createBookingManageAdapter, createDatabaseBookingAdmin, createDatabaseContactAdmin, createDatabaseContactVerification, createDatabaseCustomerAdmin, createDatabaseFeedbackAdmin, createDatabaseFeedbackPublic, createDatabaseFeedbackReporting, createDatabaseIndustryPackAdmin, createDatabaseOccurrenceAdmin, createDatabasePublicCommunicationHooks, createDatabaseQrAdmin, createDatabaseRequirementAvailabilityAdmin, createDatabaseResourceAdmin, createDatabaseServiceAdmin, createDatabaseServiceCompositionAdmin, createDatabaseTransportAdmin, createPool, createPublicBookingAdapter, createQrDestinationReader, readCommunicationSettings, saveCommunicationSettings, withTenantTransaction, type OccurrenceReservationStatusChangedEvent, type PublicBookingConfirmedEvent, type PublicBookingManagedEvent, type PublicOccurrenceReservedEvent } from "@bookingapp/database";

export interface ApiRuntimeConfig { databaseUrl: string; bookingHoldSecret: string; }
export interface DatabasePublicBookingDependencies { pool: Pool; qrReader: ReturnType<typeof createQrDestinationReader>; qrAdmin: ReturnType<typeof createDatabaseQrAdmin>; bookingPublic: ReturnType<typeof createPublicBookingAdapter>; bookingManage: ReturnType<typeof createBookingManageAdapter>; bookingAdmin: ReturnType<typeof createDatabaseBookingAdmin>; customerAdmin: ReturnType<typeof createDatabaseCustomerAdmin>; contactAdmin: ReturnType<typeof createDatabaseContactAdmin>; contactVerification: ReturnType<typeof createDatabaseContactVerification>; feedbackPublic: ReturnType<typeof createDatabaseFeedbackPublic>; feedbackAdmin: ReturnType<typeof createDatabaseFeedbackAdmin>; feedbackReporting: ReturnType<typeof createDatabaseFeedbackReporting>; resourceAdmin: ReturnType<typeof createDatabaseResourceAdmin>; serviceAdmin: ReturnType<typeof createDatabaseServiceAdmin>; compositionAdmin: ReturnType<typeof createDatabaseServiceCompositionAdmin>; requirementAvailabilityAdmin: ReturnType<typeof createDatabaseRequirementAvailabilityAdmin>; packAdmin: ReturnType<typeof createDatabaseIndustryPackAdmin>; occurrenceAdmin: ReturnType<typeof createDatabaseOccurrenceAdmin>; transportAdmin: ReturnType<typeof createDatabaseTransportAdmin>; communicationAdmin: { read(tenantId: string): Promise<Awaited<ReturnType<typeof readCommunicationSettings>>>; save(settings: import("@bookingapp/domain").CommunicationSettings): Promise<void>; }; }
export interface PublicBookingRuntimeCallbacks { onConfirmed?: (event: PublicBookingConfirmedEvent) => Promise<void>; onContactCaptured?: (input: { tenantId: string; contactMethodId: string }) => Promise<void>; onRescheduled?: (event: PublicBookingManagedEvent) => Promise<void>; onCancelled?: (event: PublicBookingManagedEvent) => Promise<void>; onOccurrenceReserved?: (event: PublicOccurrenceReservedEvent) => Promise<void>; onOccurrenceReservationStatusChanged?: (event: OccurrenceReservationStatusChangedEvent) => Promise<void>; }

export function readApiRuntimeConfig(env: Record<string, string | undefined>): ApiRuntimeConfig {
  const databaseUrl = env.DATABASE_URL?.trim();
  const bookingHoldSecret = env.BOOKING_HOLD_SECRET?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!bookingHoldSecret || bookingHoldSecret.length < 32) throw new Error("BOOKING_HOLD_SECRET must be at least 32 characters");
  return { databaseUrl, bookingHoldSecret };
}

export function createDatabasePublicBookingDependencies(config: ApiRuntimeConfig, callbacks: PublicBookingRuntimeCallbacks = {}): DatabasePublicBookingDependencies {
  const pool = createPool(config.databaseUrl);
  const communicationHooks = createDatabasePublicCommunicationHooks(pool);
  const composedCallbacks = { ...communicationHooks, ...callbacks };
  const bookingPublic = createPublicBookingAdapter(pool, config.bookingHoldSecret, composedCallbacks);
  return { pool, qrReader: createQrDestinationReader(pool), qrAdmin: createDatabaseQrAdmin(pool), bookingPublic, bookingManage: { read: bookingPublic.readManage, reschedule: bookingPublic.rescheduleManage, cancel: bookingPublic.cancelManage }, bookingAdmin: createDatabaseBookingAdmin(pool), customerAdmin: createDatabaseCustomerAdmin(pool), contactAdmin: createDatabaseContactAdmin(pool), contactVerification: createDatabaseContactVerification(pool), feedbackPublic: createDatabaseFeedbackPublic(pool), feedbackAdmin: createDatabaseFeedbackAdmin(pool), feedbackReporting: createDatabaseFeedbackReporting(pool), resourceAdmin: createDatabaseResourceAdmin(pool), serviceAdmin: createDatabaseServiceAdmin(pool), compositionAdmin: createDatabaseServiceCompositionAdmin(pool), requirementAvailabilityAdmin: createDatabaseRequirementAvailabilityAdmin(pool), packAdmin: createDatabaseIndustryPackAdmin(pool), occurrenceAdmin: createDatabaseOccurrenceAdmin(pool, { onPublicReserved: composedCallbacks.onOccurrenceReserved, onReservationStatusChanged: composedCallbacks.onOccurrenceReservationStatusChanged }), transportAdmin: createDatabaseTransportAdmin(pool), communicationAdmin: { read: (tenantId) => withTenantTransaction(pool, tenantId, (executor) => readCommunicationSettings(executor, tenantId)), save: (settings) => withTenantTransaction(pool, settings.tenantId, (executor) => saveCommunicationSettings(executor, settings)) } };
}

export function createDatabaseHealth(pool: Pool): { check(): Promise<boolean> } {
  return {
    async check() {
      await pool.query("SELECT 1");
      return true;
    },
  };
}
