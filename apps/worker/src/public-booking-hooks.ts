// Ownership: post-commit public-booking host wiring. Provider delivery stays outside booking persistence.

import { cancelPendingBookingJobs, enqueueCommunicationJob, readCommunicationSettings, withTenantTransaction, type PublicBookingConfirmedEvent, type PublicBookingManagedEvent, type SqlExecutor } from "@bookingapp/database";
import type { Pool } from "pg";
import type { CommunicationSettings, CommunicationJobDraft } from "@bookingapp/domain";
import { handleBookingCommunicationEvent } from "./booking-communication-events.js";
import type { ContactVerificationIssuer } from "./contact-verification-delivery.js";

export type PublicBookingHookExecutor = SqlExecutor;
export interface PublicBookingHookPersistence {
  withTenantTransaction<T>(tenantId: string, work: (executor: PublicBookingHookExecutor) => Promise<T>): Promise<T>;
  readSettings(executor: PublicBookingHookExecutor, tenantId: string): Promise<CommunicationSettings | null>;
  enqueue(executor: PublicBookingHookExecutor, job: CommunicationJobDraft): Promise<void>;
  cancel(executor: PublicBookingHookExecutor, tenantId: string, bookingId: string): Promise<number>;
}

export type VerificationIssuerFactory = (executor: PublicBookingHookExecutor) => ContactVerificationIssuer;
export interface PublicBookingHooks {
  onConfirmed(event: PublicBookingConfirmedEvent): Promise<void>;
  onRescheduled(event: PublicBookingManagedEvent): Promise<void>;
  onCancelled(event: PublicBookingManagedEvent): Promise<void>;
  onContactCaptured(input: { tenantId: string; contactMethodId: string }): Promise<void>;
}

export function createDatabasePublicBookingHooks(pool: Pool, createVerificationIssuer?: VerificationIssuerFactory): PublicBookingHooks {
  return createPublicBookingHooks({
    withTenantTransaction: (tenantId, work) => withTenantTransaction(pool, tenantId, work),
    readSettings: async (executor, tenantId) => readCommunicationSettings(executor, tenantId),
    enqueue: async (executor, job) => { await enqueueCommunicationJob(executor, job); },
    cancel: (executor, tenantId, bookingId) => cancelPendingBookingJobs(executor, tenantId, bookingId),
  }, createVerificationIssuer);
}

export function createPublicBookingHooks(persistence: PublicBookingHookPersistence, createVerificationIssuer?: VerificationIssuerFactory): PublicBookingHooks {
  return {
    async onConfirmed(event) {
      await persistence.withTenantTransaction(event.booking.tenantId, async (executor) => {
        const settings = await persistence.readSettings(executor, event.booking.tenantId);
        if (!settings) return;
        await handleBookingCommunicationEvent({
          type: "booking.created",
          booking: {
            tenantId: event.booking.tenantId,
            bookingId: event.booking.id,
            customerId: event.booking.customerId,
            appointmentStart: event.booking.startsAt,
            occurrence: event.booking.id,
            contactChannels: event.contactChannels,
          },
        }, {
          settings: async () => settings,
          enqueue: async (job) => persistence.enqueue(executor, job),
          cancel: async (tenantId, bookingId) => persistence.cancel(executor, tenantId, bookingId),
        });
      });
    },
    async onContactCaptured(input) {
      if (!createVerificationIssuer) return;
      await persistence.withTenantTransaction(input.tenantId, async (executor) => {
        await createVerificationIssuer(executor).issue(input);
      });
    },
    async onRescheduled(event) {
      await persistence.withTenantTransaction(event.booking.tenantId, async (executor) => {
        const settings = await persistence.readSettings(executor, event.booking.tenantId);
        if (!settings) return;
        await handleBookingCommunicationEvent({ type: "booking.rescheduled", booking: { tenantId: event.booking.tenantId, bookingId: event.booking.id, customerId: event.booking.customerId, appointmentStart: event.booking.startsAt, occurrence: `${event.booking.id}-${event.booking.startsAt.toISOString()}`, contactChannels: ["email", "sms", "voice"] } }, { settings: async () => settings, enqueue: async (job) => persistence.enqueue(executor, job), cancel: async (tenantId, bookingId) => persistence.cancel(executor, tenantId, bookingId) });
      });
    },
    async onCancelled(event) {
      await persistence.withTenantTransaction(event.booking.tenantId, async (executor) => { await persistence.cancel(executor, event.booking.tenantId, event.booking.id); });
    },
  };
}
