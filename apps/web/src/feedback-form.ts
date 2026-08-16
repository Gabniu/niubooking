// Ownership: accessible feedback form model. The renderer receives only an approved public survey.

import type { PublicFeedbackResponse } from "@bookingapp/contracts";

export type FeedbackAnswer = string | number;
export type FeedbackAnswers = Readonly<Record<string, FeedbackAnswer>>;
export type FeedbackFormState = { kind: "ready"; answers: FeedbackAnswers; errors: readonly string[] } | { kind: "submitted" } | { kind: "unavailable"; message: string };
export type FeedbackSurvey = NonNullable<PublicFeedbackResponse["data"]>;

export function feedbackPages(survey: FeedbackSurvey): readonly FeedbackSurvey["questions"][] {
  if (survey.presentation === "conversation") return survey.questions.map((question) => [question]);
  if (survey.presentation === "steps" && survey.questionsPerStep && survey.questionsPerStep > 0) {
    const pages: FeedbackSurvey["questions"][] = [];
    for (let index = 0; index < survey.questions.length; index += survey.questionsPerStep) pages.push(survey.questions.slice(index, index + survey.questionsPerStep));
    return pages;
  }
  return [survey.questions];
}

export function createFeedbackForm(survey: NonNullable<PublicFeedbackResponse["data"]>): FeedbackFormState {
  return { kind: "ready", answers: {}, errors: [] };
}

export function validateFeedbackForm(survey: NonNullable<PublicFeedbackResponse["data"]>, answers: FeedbackAnswers): readonly string[] {
  const errors: string[] = [];
  for (const question of survey.questions) {
    const answer = answers[question.id];
    if (question.required && (answer === undefined || answer === "")) errors.push("Please answer this question before continuing.");
    if (question.type === "rating" && answer !== undefined && (typeof answer !== "number" || answer < 1 || answer > 5)) errors.push("Please choose a rating from 1 to 5.");
    if (question.type === "choice" && answer !== undefined && (typeof answer !== "string" || !question.choices.includes(answer))) errors.push("Please choose one of the available options.");
  }
  return errors;
}
