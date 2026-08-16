import assert from "node:assert/strict";
import test from "node:test";
import { createFeedbackCampaign, createFeedbackTemplate, listFeedbackCampaigns, setFeedbackCampaignStatus } from "./feedback-admin.js";

test("lists campaigns with tenant scope", async () => {
  let params: readonly unknown[] = [];
  const campaigns = await listFeedbackCampaigns({ query: async <T>(_sql: string, p: readonly unknown[]) => { params = p; return [] as T[]; } }, "tenant-1");
  assert.deepEqual(campaigns, []);
  assert.deepEqual(params, ["tenant-1"]);
});

test("creates a tenant-scoped campaign from a validated draft", async () => {
  let statement = "";
  const campaign = await createFeedbackCampaign({ query: async <T>(sql: string) => { statement = sql; return [{ id: "campaign-1", tenantId: "tenant-1", enabled: true, audience: "any-client", templateVersion: 1, frequencyCapDays: 30, expiresAfterDays: 14 }] as T[]; } }, { id: "campaign-1", tenantId: "tenant-1", enabled: true, audience: "any-client", templateVersion: 1, frequencyCapDays: 30, expiresAfterDays: 14 });
  assert.equal(campaign.tenantId, "tenant-1");
  assert.match(statement, /INSERT INTO feedback_campaigns/);
});

test("requires a matching template before enabling a campaign", async () => {
  let calls = 0;
  await assert.rejects(() => setFeedbackCampaignStatus({ query: async <T>() => { calls += 1; return (calls === 1 ? [{ templateVersion: 1 }] : []) as T[]; } }, "tenant-1", "campaign-1", true), /matching template/i);
  assert.equal(calls, 2);
});

test("creates an append-only template version", async () => {
  let sql = "";
  const template = await createFeedbackTemplate({ query: async <T>(statement: string) => { sql = statement; return String(statement).startsWith("SELECT id") ? [{ id: "campaign-1" }] as T[] : [{ campaignId: "campaign-1", version: 2, title: "Improve", intro: "Tell us", presentation: "conversation", questionsPerStep: null, questions: [{ id: "rating", type: "rating", prompt: "How was it?", required: true, choices: [] }] }] as T[]; } }, { tenantId: "tenant-1", campaignId: "campaign-1", version: 2, title: "Improve", intro: "Tell us", presentation: "conversation", questionsPerStep: null, questions: [{ id: "rating", type: "rating", prompt: "How was it?", required: true, choices: [] }] });
  assert.equal(template.version, 2);
  assert.match(sql, /INSERT INTO feedback_templates/);
});

test("refuses a template for a campaign outside the tenant", async () => {
  await assert.rejects(() => createFeedbackTemplate({ query: async <T>() => [] as T[] }, { tenantId: "tenant-1", campaignId: "other-campaign", version: 1, title: "Improve", intro: "Tell us", presentation: "compact", questionsPerStep: null, questions: [{ id: "rating", type: "rating", prompt: "How was it?", required: true, choices: [] }] }), /campaign was not found/i);
});
