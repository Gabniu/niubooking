import assert from "node:assert/strict";
import test from "node:test";
import { fetchFeedbackResponses } from "./feedback-responses-client.js";

test("loads response summaries with campaign filtering", async () => {
  const state = await fetchFeedbackResponses(async (url, init) => { assert.match(url, /campaign-1/); assert.equal(init.credentials, "include"); return { ok: true, status: 200, json: async () => ({ data: [], error: null }) }; }, "https://booking.example", "tenant-1", "campaign-1");
  assert.deepEqual(state, { kind: "ready", responses: [] });
});
