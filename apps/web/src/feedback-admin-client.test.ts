import assert from "node:assert/strict";
import test from "node:test";
import { createFeedbackCampaign, fetchFeedbackCampaigns, setFeedbackCampaignStatus } from "./feedback-admin-client.js";

test("loads authorized feedback campaigns", async () => {
  const state = await fetchFeedbackCampaigns(async (_url, init) => { assert.equal(init.credentials, "include"); return { ok: true, status: 200, json: async () => ({ data: [], error: null }) }; }, "https://booking.example", "tenant-1");
  assert.deepEqual(state, { kind: "ready", campaigns: [] });
});

test("creates and changes status for a feedback campaign", async () => {
  const draft = { id: "campaign-1", enabled: true, audience: "any-client" as const, templateVersion: 1, frequencyCapDays: 30, expiresAfterDays: 14 };
  const created = await createFeedbackCampaign(async (_url, init) => { assert.equal(init.method, "POST"); assert.equal(init.headers["content-type"], "application/json"); return { ok: true, status: 201, json: async () => ({ data: { ...draft, tenantId: "tenant-1" }, error: null }) }; }, "https://booking.example", "tenant-1", draft);
  assert.equal(created.kind, "ready");
  const paused = await setFeedbackCampaignStatus(async (_url, init) => { assert.equal(init.method, "POST"); return { ok: true, status: 200, json: async () => ({ data: { enabled: false }, error: null }) }; }, "https://booking.example", "tenant-1", "campaign-1", false);
  assert.deepEqual(paused, { kind: "ready", enabled: false });
});
