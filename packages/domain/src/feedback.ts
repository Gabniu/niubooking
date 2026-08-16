// Ownership: versioned feedback survey domain. Responses retain the template version they answered.

export type FeedbackQuestionType = "rating" | "text" | "choice";
export type FeedbackPresentation = "compact" | "steps" | "conversation";

export interface FeedbackQuestion {
  id: string;
  type: FeedbackQuestionType;
  prompt: string;
  required: boolean;
  choices: readonly string[];
}

export interface FeedbackTemplate {
  campaignId: string;
  version: number;
  title: string;
  intro: string;
  presentation: FeedbackPresentation;
  questionsPerStep: number | null;
  questions: readonly FeedbackQuestion[];
}

export interface FeedbackResponse {
  capabilityId: string;
  campaignId: string;
  templateVersion: number;
  customerId: string;
  answers: Readonly<Record<string, string | number>>;
  submittedAt: Date;
}

export function validateFeedbackTemplate(input: unknown): readonly string[] {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return ["Feedback template is required"];
  const value = input as Partial<FeedbackTemplate>;
  if (!value.campaignId || typeof value.campaignId !== "string") errors.push("Campaign identity is required");
  if (!Number.isInteger(value.version) || (value.version ?? 0) < 1) errors.push("Template version must be a positive integer");
  if (!value.title || typeof value.title !== "string" || value.title.length > 160) errors.push("Template title is required and must be 160 characters or fewer");
  if (typeof value.intro !== "string" || value.intro.length > 1000) errors.push("Template introduction must be 1000 characters or fewer");
  const presentation = value.presentation ?? "compact";
  const questionsPerStep = value.questionsPerStep ?? null;
  if (presentation !== "compact" && presentation !== "steps" && presentation !== "conversation") errors.push("Template presentation is invalid");
  if (questionsPerStep !== null && (!Number.isInteger(questionsPerStep) || questionsPerStep < 1)) errors.push("Questions per step must be a positive integer");
  if (presentation === "steps" && questionsPerStep === null) errors.push("Step presentation needs a questions-per-step value");
  if (!Array.isArray(value.questions) || value.questions.length < 1) return [...errors, "Template must contain at least one question"];
  const ids = new Set<string>();
  for (const question of value.questions) {
    if (!question || typeof question !== "object") { errors.push("Each question must be an object"); continue; }
    if (!question.id || typeof question.id !== "string" || ids.has(question.id)) errors.push("Question IDs must be unique and non-empty");
    if (typeof question.id === "string") ids.add(question.id);
    if (!question.prompt || typeof question.prompt !== "string" || question.prompt.length > 500) errors.push("Question prompts are required and must be 500 characters or fewer");
    if (question.type !== "rating" && question.type !== "text" && question.type !== "choice") errors.push("Question type is invalid");
    if (question.type === "choice" && (!Array.isArray(question.choices) || question.choices.length < 2 || question.choices.some((choice: unknown) => typeof choice !== "string" || !choice.trim()))) errors.push("Choice questions need at least 2 non-empty choices");
  }
  return errors;
}

export function validateFeedbackAnswers(template: FeedbackTemplate, answers: Readonly<Record<string, string | number>>): readonly string[] {
  const errors: string[] = [];
  const questionIds = new Set(template.questions.map((question) => question.id));
  for (const answerId of Object.keys(answers)) if (!questionIds.has(answerId)) errors.push(`${answerId} is not a question in this template`);
  for (const question of template.questions) {
    const answer = answers[question.id];
    if (question.required && (answer === undefined || answer === "")) errors.push(`${question.id} is required`);
    if (question.type === "rating" && answer !== undefined && (typeof answer !== "number" || answer < 1 || answer > 5)) errors.push(`${question.id} must be rated from 1 to 5`);
    if (question.type === "choice" && answer !== undefined && (typeof answer !== "string" || !question.choices.includes(answer))) errors.push(`${question.id} has an invalid choice`);
    if (question.type === "text" && answer !== undefined && typeof answer !== "string") errors.push(`${question.id} must be text`);
  }
  return errors;
}

export function feedbackResponseKey(capabilityId: string): string { return `feedback-response:${capabilityId}`; }
