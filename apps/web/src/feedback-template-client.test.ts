import assert from "node:assert/strict";
import test from "node:test";
import { createFeedbackTemplate } from "./feedback-template-client.js";

test("creates a tenant-scoped append-only feedback template version", async () => {
  const state = await createFeedbackTemplate(async (url, init) => {
    assert.match(url, /tenant-1\/feedback-templates/);
    assert.equal(init.credentials, "include");
    assert.equal(init.method, "POST");
    assert.equal(init.headers["content-type"], "application/json");
    assert.match(init.body, /campaign-1/);
    return { ok: true, status: 201, json: async () => ({ data: { campaignId: "campaign-1", version: 2, title: "Improve", intro: "Tell us", questions: [] }, error: null }) };
  }, "https://booking.example", "tenant-1", { campaignId: "campaign-1", version: 2, title: "Improve", intro: "Tell us", questions: [] });
  assert.equal(state.kind, "ready");
});
