// Ownership: post-commit reminder outbox hooks. Provider delivery remains in the worker boundary.

import { planOccurrenceReminderJobs, planReminderJobs, type CommunicationJobDraft, type CommunicationSettings } from "@bookingapp/domain";
import type { Pool } from "pg";
import { cancelPendingBookingJobs, cancelPendingOccurrenceJobs, enqueueCommunicationJob } from "./communication-outbox.js";
import { readCommunicationSettings } from "./communications.js";
import { withTenantTransaction } from "./pg-executor.js";
import type { SqlExecutor } from "./tenant-membership.js";
import type { OccurrenceReservationStatusChangedEvent, PublicOccurrenceReservedEvent } from "./occurrences.js";
import type { PublicBookingConfirmedEvent, PublicBookingManagedEvent } from "./booking-public.js";

interface HookPersistence {
  withTenantTransaction<T>(tenantId: string, work: (executor: SqlExecutor) => Promise<T>): Promise<T>;
  readSettings(executor: SqlExecutor, tenantId: string): Promise<CommunicationSettings | null>;
  enqueue(executor: SqlExecutor, job: CommunicationJobDraft): Promise<void>;
  cancelBooking(executor: SqlExecutor, tenantId: string, bookingId: string): Promise<number>;
  cancelOccurrence(executor: SqlExecutor, tenantId: string, occurrenceId: string, reservationId: string): Promise<number>;
}

export interface PublicCommunicationHooks {
  onConfirmed(event: PublicBookingConfirmedEvent): Promise<void>;
  onContactCaptured(input: { tenantId: string; contactMethodId: string }): Promise<void>;
  onRescheduled(event: PublicBookingManagedEvent): Promise<void>;
  onCancelled(event: PublicBookingManagedEvent): Promise<void>;
  onOccurrenceReserved(event: PublicOccurrenceReservedEvent): Promise<void>;
  onOccurrenceReservationStatusChanged(event: OccurrenceReservationStatusChangedEvent): Promise<void>;
}

function bookingContext(event: PublicBookingConfirmedEvent | PublicBookingManagedEvent) {
  return { tenantId: event.booking.tenantId, bookingId: event.booking.id, customerId: event.booking.customerId, appointmentStart: event.booking.startsAt, occurrence: `${event.booking.id}-${event.booking.startsAt.toISOString()}`, contactChannels: "contactChannels" in event ? event.contactChannels : ["email", "sms", "voice"] as const };
}

export function createPublicCommunicationHooks(persistence: HookPersistence): PublicCommunicationHooks {
  return {
    async onConfirmed(event) {
      await persistence.withTenantTransaction(event.booking.tenantId, async (executor) => {
        const settings = await persistence.readSettings(executor, event.booking.tenantId);
        if (!settings) return;
        for (const job of planReminderJobs(settings, bookingContext(event))) await persistence.enqueue(executor, job);
      });
    },
    async onContactCaptured() {},
    async onRescheduled(event) {
      await persistence.withTenantTransaction(event.booking.tenantId, async (executor) => {
        await persistence.cancelBooking(executor, event.booking.tenantId, event.booking.id);
        const settings = await persistence.readSettings(executor, event.booking.tenantId);
        if (!settings) return;
        for (const job of planReminderJobs(settings, bookingContext(event))) await persistence.enqueue(executor, job);
      });
    },
    async onCancelled(event) {
      await persistence.withTenantTransaction(event.booking.tenantId, (executor) => persistence.cancelBooking(executor, event.booking.tenantId, event.booking.id).then(() => undefined));
    },
    async onOccurrenceReserved(event) {
      await persistence.withTenantTransaction(event.reservation.tenantId, async (executor) => {
        const settings = await persistence.readSettings(executor, event.reservation.tenantId);
        if (!settings) return;
        const context = { tenantId: event.reservation.tenantId, occurrenceId: event.occurrence.id, reservationId: event.reservation.id, customerId: event.reservation.customerId, occurrenceStart: event.occurrence.startsAt, contactChannels: event.contactChannels };
        for (const job of planOccurrenceReminderJobs(settings, context)) await persistence.enqueue(executor, job);
      });
    },
    async onOccurrenceReservationStatusChanged(event) {
      if (!["completed", "cancelled", "no_show"].includes(event.reservation.status)) return;
      await persistence.withTenantTransaction(event.reservation.tenantId, (executor) => persistence.cancelOccurrence(executor, event.reservation.tenantId, event.reservation.occurrenceId, event.reservation.id).then(() => undefined));
    },
  };
}

export function createDatabasePublicCommunicationHooks(pool: Pool): PublicCommunicationHooks {
  return createPublicCommunicationHooks({
    withTenantTransaction: (tenantId, work) => withTenantTransaction(pool, tenantId, work),
    readSettings: (executor, tenantId) => readCommunicationSettings(executor, tenantId),
    enqueue: async (executor, job) => { await enqueueCommunicationJob(executor, job); },
    cancelBooking: (executor, tenantId, bookingId) => cancelPendingBookingJobs(executor, tenantId, bookingId),
    cancelOccurrence: (executor, tenantId, occurrenceId, reservationId) => cancelPendingOccurrenceJobs(executor, tenantId, occurrenceId, reservationId),
  });
}
