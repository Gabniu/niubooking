import assert from "node:assert/strict";
import test from "node:test";
import { fetchFeedback, submitFeedback } from "./feedback-client.js";

test("loads and submits a public feedback survey", async () => {
  const ready = await fetchFeedback(async () => ({ ok: true, status: 200, json: async () => ({ data: { capabilityId: "cap-1", campaignId: "campaign-1", title: "Improve", intro: "Tell us", templateVersion: 1, presentation: "compact", questionsPerStep: null, questions: [] }, error: null }) }), "https://booking.example", "cap-1");
  assert.equal(ready.kind, "ready");
  const submitted = await submitFeedback(async (_url, init) => { assert.equal(init.method, "POST"); assert.equal(init.headers["content-type"], "application/json"); return { ok: true, status: 201, json: async () => ({ data: { submitted: true }, error: null }) }; }, "https://booking.example", "cap-1", { rating: 5 });
  assert.equal(submitted.kind, "submitted");
});
