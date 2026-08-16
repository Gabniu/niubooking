// Ownership: public, capability-bound feedback experience. Presentation is chosen by the survey creator.

import { fetchFeedback, submitFeedback } from "./feedback-client.js";
import { createFeedbackForm, feedbackPages, validateFeedbackForm, type FeedbackAnswers, type FeedbackSurvey } from "./feedback-form.js";

const root = document.querySelector<HTMLElement>("[data-feedback-page]");
if (!root) throw new Error("Feedback page root is missing");
const title = root.querySelector<HTMLElement>("#feedback-title");
const intro = root.querySelector<HTMLElement>("#feedback-intro");
const progress = root.querySelector<HTMLElement>("#feedback-progress");
const content = root.querySelector<HTMLElement>("#feedback-content");
const status = root.querySelector<HTMLElement>("#feedback-status");
if (!title || !intro || !progress || !content || !status) throw new Error("Feedback page controls are incomplete");
const pageTitle = title;
const pageIntro = intro;
const pageProgress = progress;
const pageContent = content;
const pageStatus = status;

const apiBase = root.dataset.apiBase || "";
const capabilityId = root.dataset.capabilityId || new URLSearchParams(location.search).get("capability") || "";
let survey: FeedbackSurvey | null = null;
let pages: readonly FeedbackSurvey["questions"][] = [];
let pageIndex = 0;
let answers: FeedbackAnswers = {};

function setStatus(message: string, kind: "loading" | "error" | "success" | "muted" = "muted"): void { pageStatus.dataset.state = kind; pageStatus.textContent = message; pageStatus.hidden = !message; }
function clear(element: HTMLElement): void { element.replaceChildren(); }
function button(label: string, type: "button" | "submit", className = "account-button"): HTMLButtonElement { const value = document.createElement("button"); value.type = type; value.className = className; value.textContent = label; return value; }

function questionControl(question: FeedbackSurvey["questions"][number]): HTMLElement {
  const fieldset = document.createElement("fieldset"); fieldset.className = "public-question";
  const legend = document.createElement("legend"); legend.textContent = question.prompt; fieldset.append(legend);
  if (question.required) { const required = document.createElement("span"); required.className = "question-required"; required.textContent = "Required"; legend.append(" ", required); }
  if (question.type === "text") { const input = document.createElement("textarea"); input.name = question.id; input.rows = 4; input.placeholder = "Share what feels useful…"; input.value = String(answers[question.id] ?? ""); fieldset.append(input); return fieldset; }
  const options = question.type === "rating" ? ["1", "2", "3", "4", "5"] : question.choices;
  const list = document.createElement("div"); list.className = "public-options";
  for (const option of options) { const label = document.createElement("label"); const input = document.createElement("input"); input.type = "radio"; input.name = question.id; input.value = option; input.checked = String(answers[question.id] ?? "") === option; label.append(input, document.createTextNode(question.type === "rating" ? `${option} / 5` : option)); list.append(label); }
  fieldset.append(list); return fieldset;
}

function readVisibleAnswers(): void {
  const next = { ...answers };
  for (const question of pages[pageIndex] ?? []) {
    const control = pageContent.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${CSS.escape(question.id)}"]:checked, textarea[name="${CSS.escape(question.id)}"]`);
    if (control?.value) next[question.id] = question.type === "rating" ? Number(control.value) : control.value;
  }
  answers = next;
}

function render(): void {
  if (!survey) return;
  clear(pageContent);
  const page = pages[pageIndex] ?? [];
  pageProgress.textContent = pages.length > 1 ? `Part ${pageIndex + 1} of ${pages.length}` : "A short conversation";
  const form = document.createElement("form"); form.className = "public-feedback-form";
  const heading = document.createElement("p"); heading.className = "feedback-step-copy"; heading.textContent = survey.presentation === "conversation" && pageIndex > 0 ? "Thank you — one more thought." : survey.presentation === "conversation" ? "Let’s take this one question at a time." : "Take your time. You can move back before sending."; form.append(heading);
  for (const question of page) form.append(questionControl(question));
  const actions = document.createElement("div"); actions.className = "feedback-actions";
  if (pageIndex > 0) actions.append(button("Back", "button"));
  const isLast = pageIndex === pages.length - 1;
  const continueButton = button(isLast ? "Send feedback" : "Continue", isLast ? "submit" : "button", "primary-button");
  actions.append(continueButton); form.append(actions); pageContent.append(form);
  form.querySelector<HTMLButtonElement>(".account-button")?.addEventListener("click", () => { readVisibleAnswers(); pageIndex -= 1; render(); });
  form.addEventListener("submit", async (event) => { event.preventDefault(); readVisibleAnswers(); await send(); });
  if (!isLast) continueButton.addEventListener("click", () => { readVisibleAnswers(); const errors = validateFeedbackForm(survey!, answers); const currentErrors = errors.filter((error) => page.some((question) => error.startsWith(`${question.id} `))); if (currentErrors.length) return setStatus(currentErrors.join(" "), "error"); pageIndex += 1; setStatus("", "muted"); render(); });
}

async function send(): Promise<void> {
  if (!survey) return;
  const errors = validateFeedbackForm(survey, answers);
  if (errors.length) return setStatus(errors.join(" "), "error");
  setStatus("Sending your feedback…", "loading");
  const result = await submitFeedback(window.fetch.bind(window), apiBase, capabilityId, answers);
  if (result.kind === "submitted") { clear(pageContent); const heading = document.createElement("h2"); heading.textContent = "Thank you for telling us."; const copy = document.createElement("p"); copy.textContent = "Your feedback has been shared with the team."; pageContent.append(heading, copy); setStatus("Feedback sent", "success"); return; }
  if (result.kind === "unavailable" || result.kind === "error") setStatus(result.message, "error");
}

async function load(): Promise<void> {
  if (!capabilityId) return setStatus("This feedback link is missing its secure capability.", "error");
  setStatus("Opening your feedback conversation…", "loading");
  const result = await fetchFeedback(window.fetch.bind(window), apiBase, capabilityId);
  if (result.kind === "unavailable" || result.kind === "error") return setStatus(result.message, result.kind === "unavailable" ? "muted" : "error");
  if (result.kind !== "ready") return setStatus("This feedback form could not be opened.", "error");
  const loadedSurvey = result.survey;
  survey = loadedSurvey; pages = feedbackPages(loadedSurvey); const form = createFeedbackForm(loadedSurvey); if (form.kind !== "ready") return setStatus("This feedback form could not be opened.", "error"); answers = form.answers; pageTitle.textContent = loadedSurvey.title; pageIntro.textContent = loadedSurvey.intro; render(); setStatus("", "muted");
}

void load();
