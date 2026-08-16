// Ownership: provider boundary. Adapters deliver messages; they cannot mutate Booking records.

import type { CommunicationChannel, CommunicationJob } from "@bookingapp/domain";
import type { SqlExecutor } from "@bookingapp/database";
import type { CommunicationProvider } from "./communication-worker.js";
import { createFeedbackDeliveryProvider } from "./feedback-delivery.js";

export interface ChannelProvider {
  send(input: { job: CommunicationJob; idempotencyKey: string }): Promise<void>;
}

export type ChannelProviders = Partial<Record<CommunicationChannel, ChannelProvider>>;
export interface ProviderRouterOptions { feedback?: { executor: SqlExecutor; publicBaseUrl: string } }

export function createProviderRouter(providers: ChannelProviders, options: ProviderRouterOptions = {}): CommunicationProvider {
  const routedProviders: ChannelProviders = options.feedback ? Object.fromEntries(Object.entries(providers).map(([channel, provider]) => [channel, provider ? createFeedbackDeliveryProvider(options.feedback!.executor, { publicBaseUrl: options.feedback!.publicBaseUrl }, provider) : provider])) as ChannelProviders : providers;
  return {
    async send(job) {
      const provider = routedProviders[job.channel];
      if (!provider) throw new Error(`No provider configured for ${job.channel}`);
      await provider.send({ job, idempotencyKey: job.idempotencyKey });
    },
  };
}
