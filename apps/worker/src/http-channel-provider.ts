// Ownership: production-shaped outbound channel adapter. Network access is injected for tests and deployment policy.

import type { CommunicationJob } from "@bookingapp/domain";
import type { ChannelProvider } from "./provider-router.js";
import { ProviderError } from "./provider-outcomes.js";

export interface HttpProviderResponse { ok: boolean; status: number; text(): Promise<string>; }
export type HttpRequester = (url: string, init: { method: "POST"; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<HttpProviderResponse>;

export function createHttpChannelProvider(config: { providerName: string; endpoint: string; apiKey: string; timeoutMs?: number }, request: HttpRequester): ChannelProvider {
  const endpoint = new URL(config.endpoint);
  if (endpoint.protocol !== "https:") throw new Error("Provider endpoint must use HTTPS");
  if (!config.apiKey) throw new Error("Provider API key is required");
  return {
    async send({ job, idempotencyKey }: { job: CommunicationJob; idempotencyKey: string }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 10_000);
      try {
        const response = await request(endpoint.toString(), { method: "POST", headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify({ tenantId: job.tenantId, jobId: job.id, kind: job.kind, channel: job.channel, customerId: job.customerId, recipient: job.recipient ?? null, bookingId: job.bookingId, feedbackUrl: job.feedbackUrl ?? null, verificationChallengeId: job.verificationChallengeId ?? null, verificationCode: job.verificationCode ?? null, verificationUrl: job.verificationUrl ?? null }), signal: controller.signal });
        if (!response.ok) throw new ProviderError(`${config.providerName} returned ${response.status}`, response.status >= 500 || response.status === 429);
        await response.text();
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        throw new ProviderError(`${config.providerName} request failed`, true);
      } finally { clearTimeout(timeout); }
    },
  };
}
