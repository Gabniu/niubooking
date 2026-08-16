import assert from "node:assert/strict";
import test from "node:test";
import { aggregateFeedback } from "./feedback-analytics.js";

test("aggregates ratings and choices without returning raw responses", () => {
  const result = aggregateFeedback("campaign-1", 2, [{ answers: { rating: 5, reason: "care" } }, { answers: { rating: 3, reason: "care" } }]);
  assert.deepEqual(result, { campaignId: "campaign-1", templateVersion: 2, responseCount: 2, averageRating: 4, ratingCount: 2, choiceCounts: { reason: { care: 2 } } });
});
