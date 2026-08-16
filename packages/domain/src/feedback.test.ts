import assert from "node:assert/strict";
import test from "node:test";
import { feedbackResponseKey, validateFeedbackAnswers, validateFeedbackTemplate, type FeedbackTemplate } from "./feedback.js";

const template: FeedbackTemplate = { campaignId: "campaign-1", version: 2, title: "Help us improve", intro: "A short survey", presentation: "conversation", questionsPerStep: null, questions: [{ id: "rating", type: "rating", prompt: "How was it?", required: true, choices: [] }, { id: "reason", type: "choice", prompt: "Why?", required: false, choices: ["speed", "care"] }] };

test("validates versioned rating and choice answers", () => {
  assert.deepEqual(validateFeedbackAnswers(template, { rating: 5, reason: "care" }), []);
  assert.deepEqual(validateFeedbackAnswers(template, { rating: 9, reason: "unknown" }), ["rating must be rated from 1 to 5", "reason has an invalid choice"]);
});

test("requires required answers and provides an idempotent response key", () => {
  assert.deepEqual(validateFeedbackAnswers(template, {}), ["rating is required"]);
  assert.equal(feedbackResponseKey("cap-1"), "feedback-response:cap-1");
});

test("rejects answers that are not part of the approved template", () => {
  assert.deepEqual(validateFeedbackAnswers(template, { rating: 5, extra: "unexpected" }), ["extra is not a question in this template"]);
  assert.deepEqual(validateFeedbackAnswers(template, { rating: 5, reason: 4 }), ["reason has an invalid choice"]);
});

test("rejects unsafe feedback template shapes before persistence", () => {
  assert.deepEqual(validateFeedbackTemplate({ campaignId: "campaign-1", version: 1, title: "", intro: "", questions: [] }), ["Template title is required and must be 160 characters or fewer", "Template must contain at least one question"]);
  assert.deepEqual(validateFeedbackTemplate({ campaignId: "campaign-1", version: 1, title: "Improve", intro: "Tell us", questions: [{ id: "reason", type: "choice", prompt: "Why?", required: true, choices: ["only"] }] }), ["Choice questions need at least 2 non-empty choices"]);
});

test("accepts an uncapped conversational template and validates creator step size", () => {
  const questions = Array.from({ length: 13 }, (_, index) => ({ id: `q-${index}`, type: "text" as const, prompt: `Question ${index}`, required: false, choices: [] }));
  assert.deepEqual(validateFeedbackTemplate({ campaignId: "campaign-1", version: 1, title: "Long form", intro: "Tell us", presentation: "conversation", questionsPerStep: null, questions }), []);
  assert.deepEqual(validateFeedbackTemplate({ campaignId: "campaign-1", version: 1, title: "Steps", intro: "Tell us", presentation: "steps", questionsPerStep: 0, questions: [questions[0]] }), ["Questions per step must be a positive integer"]);
  assert.deepEqual(validateFeedbackTemplate({ campaignId: "campaign-1", version: 1, title: "Steps", intro: "Tell us", presentation: "steps", questions }), ["Step presentation needs a questions-per-step value"]);
});
