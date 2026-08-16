// Ownership: local development provider. It records deliveries without contacting external systems.

import type { CommunicationJob } from "@bookingapp/domain";
import type { ChannelProvider } from "./provider-router.js";
import { type DeliveryReceipt } from "./provider-outcomes.js";

export interface DevelopmentDelivery extends DeliveryReceipt {
  jobId: string;
  idempotencyKey: string;
}

export function createDevelopmentProvider(onDelivery: (delivery: DevelopmentDelivery) => void): ChannelProvider {
  return {
    async send({ job, idempotencyKey }: { job: CommunicationJob; idempotencyKey: string }) {
      onDelivery({ jobId: job.id, idempotencyKey, outcome: "sent", provider: "development", providerMessageId: `dev-${job.id}`, detail: null });
    },
  };
}
