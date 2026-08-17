// Ownership: HTTP boundary tests proving the frontend-facing contract is real.
import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "./server.js";
const identity = { issuer: "https://novaauth.niuautomations.com", subject: "sub-1" };
const membership = {
  userId: "user-1",
  tenantId: "tenant-1",
  branchIds: ["branch-1"],
  role: "owner",
  status: "active" as const,
};
const qrDestination = {
  publicCode: "branch-booking-code-01",
  tenantId: "tenant-1",
  branchId: "branch-1",
  packId: "dental",
  serviceId: "consultation",
  campaign: "front-desk",
  status: "active" as const,
  expiresAt: null,
};
test("serves an admitted tenant context over HTTP", async () => {
  const app = createApiServer({
    resolve: (request) => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: request.params.tenantId }),
  });
  const response = await app.inject({ method: "GET", url: "/v1/tenant-context/tenant-1" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    data: { tenantId: "tenant-1", userId: "user-1", role: "owner", branchIds: ["branch-1"] },
    error: null,
  });
  await app.close();
});


test("returns an authorization response without leaking tenant data", async () => {
  const app = createApiServer({
    resolve: (request) => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: request.params.tenantId }),
  });
  const response = await app.inject({ method: "GET", url: "/v1/tenant-context/tenant-2" });
  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), {
    data: null,
    error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." },
  });
  await app.close();
});

test("resolves a public QR destination without exposing internal booking data", async () => {
  const app = createApiServer({
    resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }),
    qrReader: { findByPublicCode: async () => qrDestination },
  });
  const response = await app.inject({ method: "GET", url: "/v1/public/qr/branch-booking-code-01" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data, {
    publicCode: qrDestination.publicCode,
    tenantId: qrDestination.tenantId,
    branchId: qrDestination.branchId,
    packId: qrDestination.packId,
    serviceId: qrDestination.serviceId,
    campaign: qrDestination.campaign,
  });
  await app.close();
});

test("returns a generic inactive QR response", async () => {
  const app = createApiServer({
    resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }),
    qrReader: { findByPublicCode: async () => ({ ...qrDestination, status: "paused" }) },
  });
  const response = await app.inject({ method: "GET", url: "/v1/public/qr/branch-booking-code-01" });
  assert.equal(response.statusCode, 410);
  assert.deepEqual(response.json(), { data: null, error: { code: "QR_INACTIVE", message: "This booking link is temporarily unavailable." } });
  await app.close();
});

test("allows an admitted manager to create and pause a QR destination", async () => {
  let created: { publicCode: string; tenantId: string } | undefined;
  let status: string | undefined;
  const app = createApiServer({
    resolve: () => ({ identity, mappedUserId: "user-1", membership: { ...membership, role: "manager" }, requestedTenantId: "tenant-1" }),
    qrAdmin: {
      list: async () => [],
      create: async (input) => { created = input; return input; },
      setStatus: async (_tenantId, _code, next) => { status = next; return true; },
    },
  });
  const createdResponse = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/qr-destinations", payload: { branchId: "branch-1", campaign: "front-desk" } });
  assert.equal(createdResponse.statusCode, 201);
  assert.equal(created?.tenantId, "tenant-1");
  assert.match(created?.publicCode ?? "", /^[A-Za-z0-9_-]{24}$/);
  const paused = await app.inject({ method: "POST", url: `/v1/tenants/tenant-1/qr-destinations/${created?.publicCode}/status`, payload: { status: "paused" } });
  assert.equal(paused.statusCode, 200);
  assert.equal(status, "paused");
  await app.close();
});

test("allows an admitted manager to replace a QR destination", async () => { const replacement = { ...qrDestination, publicCode: "replacement-code-01" }; let oldCode = ""; const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership: { ...membership, role: "manager" }, requestedTenantId: "tenant-1" }), qrAdmin: { list: async () => [], create: async (input) => input, setStatus: async () => true, rotate: async (_tenantId, code) => { oldCode = code; return replacement; } } }); const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/qr-destinations/old-code/rotate" }); assert.equal(response.statusCode, 201); assert.equal(oldCode, "old-code"); assert.equal(response.json().data.publicCode, replacement.publicCode); await app.close(); });
test("rejects malformed QR expiry and lifecycle status", async () => { const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), qrAdmin: { list: async () => [], create: async (input) => input, setStatus: async () => true } }); const invalidExpiry = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/qr-destinations", payload: { expiresAt: "not-a-date" } }); assert.equal(invalidExpiry.statusCode, 400); const invalidStatus = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/qr-destinations/code/status", payload: { status: "deleted" } }); assert.equal(invalidStatus.statusCode, 400); await app.close(); });
test("denies QR administration without active tenant membership", async () => {
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership: null, requestedTenantId: "tenant-1" }), qrAdmin: { list: async () => [], create: async (input) => input, setStatus: async () => true } });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/qr-destinations", payload: {} });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test("lists QR destinations for an admitted tenant", async () => {
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), qrAdmin: { list: async (tenantId) => [{ publicCode: "branch-booking-code-01", tenantId }], create: async (input) => input, setStatus: async () => true } });
  const response = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/qr-destinations" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data, [{ publicCode: "branch-booking-code-01", tenantId: "tenant-1" }]);
  await app.close();
});

test("lists feedback campaigns for authorized staff", async () => {
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), feedbackAdmin: { listCampaigns: async () => [], createTemplate: async (input) => input } });
  const response = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/feedback-campaigns" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data, []);
  await app.close();
});

test("creates and pauses a feedback campaign for authorized staff", async () => {
  let createdTenant = "";
  let statusEnabled = true;
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), feedbackAdmin: { listCampaigns: async () => [], createTemplate: async (input) => input, createCampaign: async (input) => { createdTenant = input.tenantId; return input; }, setCampaignStatus: async (_tenantId, _campaignId, enabled) => { statusEnabled = enabled; return true; } } });
  const created = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/feedback-campaigns", payload: { id: "campaign-1", enabled: true, audience: "any-client", templateVersion: 1, frequencyCapDays: 30, expiresAfterDays: 14 } });
  assert.equal(created.statusCode, 201);
  assert.equal(createdTenant, "tenant-1");
  const paused = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/feedback-campaigns/campaign-1/status", payload: { enabled: false } });
  assert.equal(paused.statusCode, 200);
  assert.equal(statusEnabled, false);
  await app.close();
});

test("rejects an unsafe feedback campaign before persistence", async () => {
  let called = false;
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), feedbackAdmin: { listCampaigns: async () => [], createTemplate: async (input) => input, createCampaign: async (input) => { called = true; return input; } } });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/feedback-campaigns", payload: { id: "campaign-1", enabled: true, audience: "completed-appointment", templateVersion: 1, frequencyCapDays: 0, expiresAfterDays: 91 } });
  assert.equal(response.statusCode, 400);
  assert.equal(called, false);
  await app.close();
});

test("rejects invalid feedback template questions before persistence", async () => {
  let called = false;
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), feedbackAdmin: { listCampaigns: async () => [], createTemplate: async (input) => { called = true; return input; } } });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/feedback-templates", payload: { campaignId: "campaign-1", version: 2, title: "Improve", intro: "Tell us", presentation: "compact", questionsPerStep: null, questions: [{ id: "reason", type: "choice", prompt: "Why?", required: true, choices: ["only"] }] } });
  assert.equal(response.statusCode, 400);
  assert.equal(called, false);
  await app.close();
});

test("creates a valid append-only feedback template version", async () => {
  let created: unknown;
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), feedbackAdmin: { listCampaigns: async () => [], createTemplate: async (input) => { created = input; return input; } } });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/feedback-templates", payload: { campaignId: "campaign-1", version: 2, title: "Improve", intro: "Tell us", presentation: "conversation", questionsPerStep: null, questions: [{ id: "rating", type: "rating", prompt: "How was it?", required: true, choices: [] }] } });
  assert.equal(response.statusCode, 201);
  assert.equal((created as { tenantId: string }).tenantId, "tenant-1");
  await app.close();
});

test("serves creator-selected feedback presentation to the public client", async () => {
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), feedbackPublic: { read: async () => ({ capabilityId: "cap-1", campaignId: "campaign-1", templateVersion: 3, expiresAt: new Date(Date.now() + 60_000), usedAt: null, template: { campaignId: "campaign-1", version: 3, title: "Tell us", intro: "One thought at a time", presentation: "conversation", questionsPerStep: null, questions: [{ id: "q-1", type: "text", prompt: "What helped?", required: true, choices: [] }] } }), submit: async () => true } });
  const response = await app.inject({ method: "GET", url: "/v1/public/feedback/cap-1" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.presentation, "conversation");
  assert.equal(response.json().data.questionsPerStep, null);
  await app.close();
});

test("rejects public feedback answers that are not in the approved template", async () => {
  let submitted = false;
  const read = async () => ({ capabilityId: "cap-1", campaignId: "campaign-1", templateVersion: 3, expiresAt: new Date(Date.now() + 60_000), usedAt: null, template: { campaignId: "campaign-1", version: 3, title: "Tell us", intro: "One thought at a time", presentation: "conversation" as const, questionsPerStep: null, questions: [{ id: "q-1", type: "text" as const, prompt: "What helped?", required: true, choices: [] }] } });
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), feedbackPublic: { read, submit: async () => { submitted = true; return true; } } });
  const response = await app.inject({ method: "POST", url: "/v1/public/feedback/cap-1", payload: { answers: { extra: "unexpected" } } });
  assert.equal(response.statusCode, 400);
  assert.equal(submitted, false);
  assert.equal(response.json().error.code, "FEEDBACK_INVALID");
  await app.close();
});

test("accepts valid public feedback answers after template validation", async () => {
  let submittedAnswers: Readonly<Record<string, string | number>> = {};
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), feedbackPublic: { read: async () => ({ capabilityId: "cap-1", campaignId: "campaign-1", templateVersion: 3, expiresAt: new Date(Date.now() + 60_000), usedAt: null, template: { campaignId: "campaign-1", version: 3, title: "Tell us", intro: "One thought at a time", presentation: "conversation", questionsPerStep: null, questions: [{ id: "q-1", type: "text", prompt: "What helped?", required: true, choices: [] }] } }), submit: async (input) => { submittedAnswers = input.answers; return true; } } });
  const response = await app.inject({ method: "POST", url: "/v1/public/feedback/cap-1", payload: { answers: { "q-1": "The welcome was clear." } } });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(submittedAnswers, { "q-1": "The welcome was clear." });
  await app.close();
});

test("lists feedback responses for authorized staff", async () => {
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), feedbackReporting: { listResponses: async () => [], analytics: async () => null } });
  const response = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/feedback-responses?campaignId=campaign-1" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data, []);
  await app.close();
});

test("returns aggregate feedback analytics for authorized staff", async () => {
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), feedbackReporting: { listResponses: async () => [], analytics: async () => ({ campaignId: "campaign-1", templateVersion: 2, responseCount: 3, averageRating: 4.33, ratingCount: 3, choiceCounts: {} }) } });
  const response = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/feedback-campaigns/campaign-1/analytics?templateVersion=2" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.responseCount, 3);
  await app.close();
});

test("reads and updates communication settings for authorized staff", async () => {
  let savedTenant = "";
  const communicationAdmin = { read: async () => ({ tenantId: "tenant-1", timezone: "UTC", remindersEnabled: true, feedbackEnabled: true, defaultFeedbackFrequencyDays: 30, reminderRules: [] }), save: async (settings: { tenantId: string }) => { savedTenant = settings.tenantId; } };
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), communicationAdmin });
  const read = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/communication-settings" });
  assert.equal(read.statusCode, 200);
  const update = await app.inject({ method: "PUT", url: "/v1/tenants/tenant-1/communication-settings", payload: { timezone: "UTC", remindersEnabled: true, feedbackEnabled: true, defaultFeedbackFrequencyDays: 30, reminderRules: [], bookingChangePolicy: { rescheduleEnabled: true, cancellationEnabled: true, minimumNoticeMinutes: 0 } } });
  assert.equal(update.statusCode, 204);
  assert.equal(savedTenant, "tenant-1");
  await app.close();
});

test("rejects an unsafe booking-change policy before persistence", async () => {
  let saved = false;
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), communicationAdmin: { read: async () => null, save: async () => { saved = true; } } });
  const response = await app.inject({ method: "PUT", url: "/v1/tenants/tenant-1/communication-settings", payload: { timezone: "UTC", remindersEnabled: true, feedbackEnabled: true, defaultFeedbackFrequencyDays: 30, reminderRules: [], bookingChangePolicy: { rescheduleEnabled: true, cancellationEnabled: true, minimumNoticeMinutes: 43_201 } } });
  assert.equal(response.statusCode, 400);
  assert.equal(saved, false);
  await app.close();
});

test("lists masked contact methods and creates a pending contact method", async () => {
  let saved: { tenantId: string; customerId: string; verifiedAt: Date | null } | undefined;
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), contactAdmin: { list: async () => [{ id: "contact-1", customerId: "customer-1", channel: "email", maskedDestination: "p•••@example.test", consentStatus: "granted", verifiedAt: null, enabled: true, priority: 1 }], upsert: async (input) => { saved = input; } } });
  const list = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/contact-methods" });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data[0].maskedDestination, "p•••@example.test");
  const created = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/contact-methods", payload: { customerId: "customer-2", channel: "sms", destination: "+254700000000", consentStatus: "granted" } });
  assert.equal(created.statusCode, 204);
  assert.equal(saved?.tenantId, "tenant-1");
  assert.equal(saved?.customerId, "customer-2");
  assert.equal(saved?.verifiedAt, null);
  await app.close();
});

test("rejects invalid contact-method input before persistence", async () => {
  let called = false;
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), contactAdmin: { list: async () => [], upsert: async () => { called = true; } } });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/contact-methods", payload: { customerId: "", channel: "sms", destination: "bad", consentStatus: "granted" } });
  assert.equal(response.statusCode, 400);
  assert.equal(called, false);
  await app.close();
});

test("issues a tenant-scoped verification challenge without returning a code", async () => {
  let requested = "";
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), contactAdmin: { list: async () => [], upsert: async () => {}, issueChallenge: async (input) => { requested = input.contactMethodId; return { challengeId: "challenge-1", expiresAt: new Date("2026-08-13T12:00:00Z") }; } } });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/contact-methods/contact-1/verification-challenge" });
  assert.equal(response.statusCode, 201);
  assert.equal(requested, "contact-1");
  assert.deepEqual(response.json().data, { challengeId: "challenge-1", expiresAt: "2026-08-13T12:00:00.000Z" });
  assert.equal("code" in response.json().data, false);
  await app.close();
});

test("verifies a public contact challenge and maps expired or invalid states", async () => {
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), contactVerification: { verify: async (_id, code) => code === "123456" ? "verified" : "expired" } });
  const verified = await app.inject({ method: "POST", url: "/v1/public/contact-verification/challenge-1", payload: { code: "123456" } });
  assert.equal(verified.statusCode, 200);
  assert.deepEqual(verified.json().data, { verified: true });
  const expired = await app.inject({ method: "POST", url: "/v1/public/contact-verification/challenge-1", payload: { code: "654321" } });
  assert.equal(expired.statusCode, 410);
  await app.close();
});

test("lists and creates tenant-scoped customer profiles", async () => {
  let created: { id: string; tenantId: string; displayName: string } | undefined;
  const profile = { id: "customer-1", tenantId: "tenant-1", displayName: "Alex Morgan", preferredLocale: null, timezone: null, status: "active" as const };
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), customerAdmin: { list: async (_tenantId, includeArchived) => [{ ...profile, status: includeArchived ? "archived" : "active" }], read: async () => profile, create: async (input) => { created = input; return input; }, update: async (input) => ({ ...profile, ...input }), setStatus: async () => true } });
  const list = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/customers" });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().data[0].displayName, "Alex Morgan");
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/customers", payload: { displayName: "  Jamie Lee  " } });
  assert.equal(response.statusCode, 201);
  assert.equal(created?.tenantId, "tenant-1");
  assert.equal(created?.displayName, "Jamie Lee");
  const detail = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/customers/customer-1" });
  assert.equal(detail.statusCode, 200);
  const updated = await app.inject({ method: "PUT", url: "/v1/tenants/tenant-1/customers/customer-1", payload: { displayName: "Jamie Lee" } });
  assert.equal(updated.statusCode, 200);
  await app.close();
});

test("rejects invalid customer profile input before persistence", async () => {
  let called = false;
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), customerAdmin: { list: async () => [], read: async () => null, create: async (input) => { called = true; return input; }, update: async () => null, setStatus: async () => true } });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/customers", payload: { displayName: "" } });
  assert.equal(response.statusCode, 400);
  assert.equal(called, false);
  await app.close();
});
