// Ownership: immediate verification-code delivery. Plaintext codes exist only for this provider call.

import { randomBytes, randomInt } from "node:crypto";
import { communicationIdempotencyKey, type CommunicationJob } from "@bookingapp/domain";
import { issueContactVerificationChallenge, readContactVerificationTarget, revokeContactVerificationChallenge, type SqlExecutor } from "@bookingapp/database";
import type { ChannelProvider } from "./provider-router.js";

export interface ContactVerificationIssuer { issue(input: { tenantId: string; contactMethodId: string }): Promise<{ challengeId: string; expiresAt: Date }>; }
export interface ContactVerificationDeliveryConfig { publicBaseUrl: string; ttlMs?: number; maxAttempts?: number; now?: () => Date; code?: () => string; }

export function createContactVerificationIssuer(executor: SqlExecutor, provider: ChannelProvider, config: ContactVerificationDeliveryConfig): ContactVerificationIssuer {
  const base = new URL(config.publicBaseUrl);
  const now = config.now ?? (() => new Date());
  const createCode = config.code ?? (() => String(randomInt(100000, 1_000_000)));
  return {
    async issue(input) {
      const target = await readContactVerificationTarget(executor, input.tenantId, input.contactMethodId);
      if (!target) throw new Error("Contact method is not eligible for verification");
      const challengeId = randomBytes(18).toString("base64url");
      const issuedAt = now();
      const expiresAt = new Date(issuedAt.getTime() + (config.ttlMs ?? 10 * 60_000));
      const code = createCode();
      await issueContactVerificationChallenge(executor, { challengeId, tenantId: target.tenantId, contactMethodId: target.id, customerId: target.customerId, channel: target.channel, code, expiresAt, ...(config.maxAttempts === undefined ? {} : { maxAttempts: config.maxAttempts }) });
      const verificationUrl = new URL("/contact-verification.html", base);
      verificationUrl.searchParams.set("challenge", challengeId);
      const job: CommunicationJob = { id: challengeId, tenantId: target.tenantId, kind: "verification", channel: target.channel, idempotencyKey: communicationIdempotencyKey({ tenantId: target.tenantId, kind: "verification", customerId: target.customerId, campaignOrRuleId: target.id, occurrence: challengeId }), scheduledFor: issuedAt, status: "claimed", bookingId: null, customerId: target.customerId, recipient: target.destination, verificationChallengeId: challengeId, verificationCode: code, verificationUrl: verificationUrl.toString() };
      try { await provider.send({ job, idempotencyKey: job.idempotencyKey }); }
      catch (error) { await revokeContactVerificationChallenge(executor, challengeId); throw error; }
      return { challengeId, expiresAt };
    },
  };
}
