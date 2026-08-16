import assert from "node:assert/strict";
import test from "node:test";
import { createHttpChannelProvider } from "./http-channel-provider.js";

const job = { id: "job-1", tenantId: "tenant-1", kind: "reminder" as const, channel: "email" as const, idempotencyKey: "tenant-1:reminder:c:r:b", scheduledFor: new Date(), status: "claimed" as const, bookingId: "booking-1", customerId: "customer-1" };

test("sends an HTTPS request with idempotency and tenant context", async () => {
  let headers: Record<string, string> = {};
  let payload: { recipient?: string; verificationCode?: string } = {};
  const provider = createHttpChannelProvider({ providerName: "mail-gateway", endpoint: "https://mail.example/send", apiKey: "secret" }, async (_url, init) => { headers = init.headers; payload = JSON.parse(init.body) as { recipient?: string }; return { ok: true, status: 202, text: async () => "accepted" }; });
  await provider.send({ job: { ...job, recipient: "person@example.test" }, idempotencyKey: job.idempotencyKey });
  assert.equal(headers["idempotency-key"], job.idempotencyKey);
  assert.equal(headers.authorization, "Bearer secret");
  assert.equal(payload.recipient, "person@example.test");
});

test("rejects insecure endpoints and classifies gateway failures", async () => {
  assert.throws(() => createHttpChannelProvider({ providerName: "mail", endpoint: "http://mail.example/send", apiKey: "secret" }, async () => ({ ok: true, status: 200, text: async () => "" })), /HTTPS/);
  const provider = createHttpChannelProvider({ providerName: "mail", endpoint: "https://mail.example/send", apiKey: "secret" }, async () => ({ ok: false, status: 503, text: async () => "down" }));
  await assert.rejects(() => provider.send({ job, idempotencyKey: job.idempotencyKey }), /returned 503/);
});

test("passes verification code only in the ephemeral provider payload", async () => {
  let payload: { kind?: string; verificationCode?: string; verificationChallengeId?: string } = {};
  const provider = createHttpChannelProvider({ providerName: "sms", endpoint: "https://sms.example/send", apiKey: "secret" }, async (_url, init) => { payload = JSON.parse(init.body) as typeof payload; return { ok: true, status: 202, text: async () => "accepted" }; });
  await provider.send({ job: { ...job, kind: "verification", verificationCode: "123456", verificationChallengeId: "challenge-1", verificationUrl: "https://booking.example/contact-verification.html?challenge=challenge-1" }, idempotencyKey: "verification-key" });
  assert.deepEqual({ kind: payload.kind, verificationCode: payload.verificationCode, verificationChallengeId: payload.verificationChallengeId }, { kind: "verification", verificationCode: "123456", verificationChallengeId: "challenge-1" });
});
