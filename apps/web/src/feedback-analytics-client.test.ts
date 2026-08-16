import assert from "node:assert/strict";
import test from "node:test";
import { fetchFeedbackAnalytics } from "./feedback-analytics-client.js";

test("loads aggregate feedback analytics", async () => {
  const state = await fetchFeedbackAnalytics(async (url, init) => { assert.match(url, /analytics/); assert.equal(init.credentials, "include"); return { ok: true, status: 200, json: async () => ({ data: { campaignId: "campaign-1", templateVersion: 2, responseCount: 3, averageRating: 4.33, ratingCount: 3, choiceCounts: {} }, error: null }) }; }, "https://booking.example", "tenant-1", "campaign-1", 2);
  assert.equal(state.kind, "ready");
});
