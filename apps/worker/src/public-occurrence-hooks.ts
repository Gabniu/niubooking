// Ownership: post-commit occurrence-reservation host wiring. Provider delivery stays outside persistence.

import { cancelPendingOccurrenceJobs, enqueueCommunicationJob, readCommunicationSettings, withTenantTransaction, type OccurrenceReservationStatusChangedEvent, type PublicOccurrenceReservedEvent, type SqlExecutor } from "@bookingapp/database";
import type { Pool } from "pg";
import type { CommunicationJobDraft, CommunicationSettings } from "@bookingapp/domain";
import { handleBookingCommunicationEvent } from "./booking-communication-events.js";

export interface PublicOccurrenceHookPersistence {
  withTenantTransaction<T>(tenantId: string, work: (executor: SqlExecutor) => Promise<T>): Promise<T>;
  readSettings(executor: SqlExecutor, tenantId: string): Promise<CommunicationSettings | null>;
  enqueue(executor: SqlExecutor, job: CommunicationJobDraft): Promise<void>;
  cancelOccurrence(executor: SqlExecutor, tenantId: string, occurrenceId: string, reservationId: string): Promise<number>;
}

export interface PublicOccurrenceHooks { onReserved(event: PublicOccurrenceReservedEvent): Promise<void>; onStatusChanged(event: OccurrenceReservationStatusChangedEvent): Promise<void>; }

export function createDatabasePublicOccurrenceHooks(pool: Pool): PublicOccurrenceHooks {
  return createPublicOccurrenceHooks({ withTenantTransaction: (tenantId, work) => withTenantTransaction(pool, tenantId, work), readSettings: (executor, tenantId) => readCommunicationSettings(executor, tenantId), enqueue: async (executor, job) => { await enqueueCommunicationJob(executor, job); }, cancelOccurrence: (executor, tenantId, occurrenceId, reservationId) => cancelPendingOccurrenceJobs(executor, tenantId, occurrenceId, reservationId) });
}

export function createPublicOccurrenceHooks(persistence: PublicOccurrenceHookPersistence): PublicOccurrenceHooks {
  return { async onReserved(event) {
    await persistence.withTenantTransaction(event.reservation.tenantId, async (executor) => {
      const settings = await persistence.readSettings(executor, event.reservation.tenantId);
      if (!settings) return;
      await handleBookingCommunicationEvent({ type: "occurrence.reserved", occurrence: { tenantId: event.reservation.tenantId, occurrenceId: event.occurrence.id, reservationId: event.reservation.id, customerId: event.reservation.customerId, occurrenceStart: event.occurrence.startsAt, contactChannels: event.contactChannels } }, { settings: async () => settings, enqueue: async (job) => persistence.enqueue(executor, job), cancel: async () => 0 });
    });
  }, async onStatusChanged(event) {
    await persistence.withTenantTransaction(event.reservation.tenantId, async (executor) => {
      await handleBookingCommunicationEvent({ type: "occurrence.reservation_status_changed", tenantId: event.reservation.tenantId, occurrenceId: event.reservation.occurrenceId, reservationId: event.reservation.id, status: event.reservation.status }, { settings: async () => { throw new Error("Settings are not needed for cancellation"); }, enqueue: async () => {}, cancel: async () => 0, cancelOccurrence: (tenantId, occurrenceId, reservationId) => persistence.cancelOccurrence(executor, tenantId, occurrenceId, reservationId) });
    });
  } };
}
