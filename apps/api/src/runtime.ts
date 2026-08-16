// Ownership: API composition boundary. Runtime secrets are validated once and never exposed to handlers.

import type { Pool } from "pg";
import { createBookingManageAdapter, createDatabaseIndustryPackAdmin, createDatabaseOccurrenceAdmin, createDatabaseRequirementAvailabilityAdmin, createDatabaseResourceAdmin, createDatabaseServiceAdmin, createDatabaseServiceCompositionAdmin, createPool, createPublicBookingAdapter, createQrDestinationReader, readCommunicationSettings, saveCommunicationSettings, withTenantTransaction, type OccurrenceReservationStatusChangedEvent, type PublicBookingConfirmedEvent, type PublicBookingManagedEvent, type PublicOccurrenceReservedEvent } from "@bookingapp/database";

export interface ApiRuntimeConfig { databaseUrl: string; bookingHoldSecret: string; }
export interface DatabasePublicBookingDependencies { pool: Pool; qrReader: ReturnType<typeof createQrDestinationReader>; bookingPublic: ReturnType<typeof createPublicBookingAdapter>; bookingManage: ReturnType<typeof createBookingManageAdapter>; resourceAdmin: ReturnType<typeof createDatabaseResourceAdmin>; serviceAdmin: ReturnType<typeof createDatabaseServiceAdmin>; compositionAdmin: ReturnType<typeof createDatabaseServiceCompositionAdmin>; requirementAvailabilityAdmin: ReturnType<typeof createDatabaseRequirementAvailabilityAdmin>; packAdmin: ReturnType<typeof createDatabaseIndustryPackAdmin>; occurrenceAdmin: ReturnType<typeof createDatabaseOccurrenceAdmin>; communicationAdmin: { read(tenantId: string): Promise<Awaited<ReturnType<typeof readCommunicationSettings>>>; save(settings: import("@bookingapp/domain").CommunicationSettings): Promise<void>; }; }
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
  const bookingPublic = createPublicBookingAdapter(pool, config.bookingHoldSecret, callbacks);
  return { pool, qrReader: createQrDestinationReader(pool), bookingPublic, bookingManage: { read: bookingPublic.readManage, reschedule: bookingPublic.rescheduleManage, cancel: bookingPublic.cancelManage }, resourceAdmin: createDatabaseResourceAdmin(pool), serviceAdmin: createDatabaseServiceAdmin(pool), compositionAdmin: createDatabaseServiceCompositionAdmin(pool), requirementAvailabilityAdmin: createDatabaseRequirementAvailabilityAdmin(pool), packAdmin: createDatabaseIndustryPackAdmin(pool), occurrenceAdmin: createDatabaseOccurrenceAdmin(pool, { onPublicReserved: callbacks.onOccurrenceReserved, onReservationStatusChanged: callbacks.onOccurrenceReservationStatusChanged }), communicationAdmin: { read: (tenantId) => withTenantTransaction(pool, tenantId, (executor) => readCommunicationSettings(executor, tenantId)), save: (settings) => withTenantTransaction(pool, settings.tenantId, (executor) => saveCommunicationSettings(executor, settings)) } };
}

export function createDatabaseHealth(pool: Pool): { check(): Promise<boolean> } {
  return {
    async check() {
      await pool.query("SELECT 1");
      return true;
    },
  };
}
