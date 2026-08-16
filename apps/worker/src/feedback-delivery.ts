// Ownership: feedback delivery enrichment. It issues an opaque link immediately before provider delivery.

import { issueFeedbackCapability, type SqlExecutor } from "@bookingapp/database";
import type { CommunicationJob } from "@bookingapp/domain";
import type { ChannelProvider } from "./provider-router.js";

export interface FeedbackDeliveryConfig { publicBaseUrl: string; }

export function createFeedbackDeliveryProvider(executor: SqlExecutor, config: FeedbackDeliveryConfig, provider: ChannelProvider): ChannelProvider {
  const base = new URL(config.publicBaseUrl);
  return {
    async send({ job, idempotencyKey }: { job: CommunicationJob; idempotencyKey: string }) {
      if (job.kind !== "feedback") return provider.send({ job, idempotencyKey });
      if (!job.campaignId || !job.templateVersion || !job.feedbackExpiresAt) throw new Error("Feedback job is missing campaign delivery metadata");
      const capability = await issueFeedbackCapability(executor, { jobId: job.id, tenantId: job.tenantId, campaignId: job.campaignId, templateVersion: job.templateVersion, customerId: job.customerId, expiresAt: job.feedbackExpiresAt });
      const feedbackUrl = new URL("/feedback.html", base); feedbackUrl.searchParams.set("capability", capability.capabilityId);
      await provider.send({ job: { ...job, feedbackUrl: feedbackUrl.toString() }, idempotencyKey });
    },
  };
}
