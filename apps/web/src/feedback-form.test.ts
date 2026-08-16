import assert from "node:assert/strict";
import test from "node:test";
import { createFeedbackForm, feedbackPages, validateFeedbackForm } from "./feedback-form.js";

const survey = { capabilityId: "cap-1", campaignId: "campaign-1", title: "Help us improve", intro: "Tell us about your experience", templateVersion: 1, presentation: "conversation" as const, questionsPerStep: null, questions: [{ id: "rating", type: "rating" as const, prompt: "How was it?", required: true, choices: [] }, { id: "reason", type: "choice" as const, prompt: "Why?", required: false, choices: ["speed", "care"] }] };

test("starts with empty answers and validates approved questions", () => {
  assert.deepEqual(createFeedbackForm(survey), { kind: "ready", answers: {}, errors: [] });
  assert.deepEqual(validateFeedbackForm(survey, { rating: 5, reason: "care" }), []);
  assert.deepEqual(validateFeedbackForm(survey, {}), ["Please answer this question before continuing."]);
});

test("keeps creator-selected progression without imposing a question cap", () => {
  const questions = Array.from({ length: 13 }, (_, index) => ({ id: `q-${index}`, type: "text" as const, prompt: `Question ${index}`, required: false, choices: [] }));
  const conversation = { ...survey, presentation: "conversation" as const, questionsPerStep: null, questions };
  const steps = { ...conversation, presentation: "steps" as const, questionsPerStep: 4 };
  assert.equal(feedbackPages(conversation).length, 13);
  assert.deepEqual(feedbackPages(steps).map((page) => page.length), [4, 4, 4, 1]);
});
