// Ownership: authorized feedback reporting workspace; raw client identity and answers stay out of this surface.

import type { FeedbackAnalyticsResponse, FeedbackCampaignSummary, FeedbackResponseSummary } from "@bookingapp/contracts";
import { createFeedbackCampaign, fetchFeedbackCampaigns, setFeedbackCampaignStatus } from "./feedback-admin-client.js";
import { fetchFeedbackAnalytics } from "./feedback-analytics-client.js";
import { fetchFeedbackResponses } from "./feedback-responses-client.js";
import { createFeedbackTemplate } from "./feedback-template-client.js";

const root = document.querySelector<HTMLElement>("[data-feedback-admin-page]");
if (!root) throw new Error("Feedback admin root is missing");
const statusElement = root.querySelector<HTMLElement>("#feedback-admin-status");
const campaignsElement = root.querySelector<HTMLElement>("#feedback-campaigns");
const campaignSelectElement = root.querySelector<HTMLSelectElement>("#feedback-campaign-select");
const analyticsElement = root.querySelector<HTMLElement>("#feedback-analytics");
const responsesElement = root.querySelector<HTMLElement>("#feedback-responses");
const campaignFormElement = root.querySelector<HTMLFormElement>("#feedback-campaign-form");
const templateFormElement = root.querySelector<HTMLFormElement>("#feedback-template-form");
const questionsElement = root.querySelector<HTMLElement>("#feedback-questions");
const addQuestionElement = root.querySelector<HTMLButtonElement>("#add-feedback-question");
const presentationElement = root.querySelector<HTMLSelectElement>("[name=presentation]");
const questionsPerStepField = root.querySelector<HTMLElement>("#questions-per-step-field");
if (!statusElement || !campaignsElement || !campaignSelectElement || !analyticsElement || !responsesElement || !campaignFormElement || !templateFormElement || !questionsElement || !addQuestionElement || !presentationElement || !questionsPerStepField) throw new Error("Feedback admin controls are incomplete");
const status = statusElement;
const campaigns = campaignsElement;
const campaignSelect = campaignSelectElement;
const analytics = analyticsElement;
const responses = responsesElement;
const campaignForm = campaignFormElement;
const templateForm = templateFormElement;
const questions = questionsElement;
const addQuestion = addQuestionElement;
const presentation = presentationElement;
const questionsPerStep = questionsPerStepField;

const tenantId = root.dataset.tenantId || new URLSearchParams(location.search).get("tenant") || "";
const apiBase = root.dataset.apiBase || "";
let campaignList: readonly FeedbackCampaignSummary[] = [];
type QuestionDraft = { id: string; type: "rating" | "text" | "choice"; prompt: string; required: boolean; choices: readonly string[] };
let questionDrafts: QuestionDraft[] = [{ id: "question-1", type: "rating", prompt: "", required: true, choices: [] }];

function setStatus(kind: "loading" | "ready" | "error" | "denied", message: string): void { status.dataset.state = kind; status.textContent = message; status.hidden = false; }
function audienceLabel(audience: FeedbackCampaignSummary["audience"]): string { return audience === "any-client" ? "Any client" : audience === "completed-appointment" ? "Completed appointment" : "Campaign audience"; }
function clear(element: HTMLElement): void { element.replaceChildren(); }
function message(element: HTMLElement, text: string, tone = "muted"): void { clear(element); const p = document.createElement("p"); p.className = `surface-message ${tone}`; p.textContent = text; element.append(p); }

function renderQuestions(): void {
  clear(questions);
  for (const [index, question] of questionDrafts.entries()) {
    const row = document.createElement("article"); row.className = "question-row"; row.dataset.questionId = question.id;
    row.innerHTML = `<div class="question-row-heading"><strong>Question ${index + 1}</strong><button type="button" class="remove-question">Remove</button></div><div class="question-fields"><label>Type<select data-field="type"><option value="rating">Rating (1–5)</option><option value="text">Free text</option><option value="choice">Choice</option></select></label><label class="question-prompt">Prompt<input data-field="prompt" maxlength="500" required /></label><label class="template-check"><input data-field="required" type="checkbox" /> Required</label><label data-field="choices-wrap">Choices<input data-field="choices" placeholder="Comma separated options" /></label></div>`;
    const type = row.querySelector<HTMLSelectElement>("[data-field=type]"); const prompt = row.querySelector<HTMLInputElement>("[data-field=prompt]"); const required = row.querySelector<HTMLInputElement>("[data-field=required]"); const choices = row.querySelector<HTMLInputElement>("[data-field=choices]"); const choicesWrap = row.querySelector<HTMLElement>("[data-field=choices-wrap]");
    if (type && prompt && required && choices && choicesWrap) { type.value = question.type; prompt.value = question.prompt; required.checked = question.required; choices.value = question.choices.join(", "); choicesWrap.hidden = question.type !== "choice"; type.addEventListener("change", () => { choicesWrap.hidden = type.value !== "choice"; }); }
    row.querySelector<HTMLButtonElement>(".remove-question")?.addEventListener("click", () => { if (questionDrafts.length === 1) return setStatus("error", "A template needs at least one question."); questionDrafts = questionDrafts.filter((item) => item.id !== question.id); renderQuestions(); });
    questions.append(row);
  }
}

function renderCampaigns(): void {
  clear(campaigns); campaignSelect.replaceChildren();
  const templateCampaign = templateForm.elements.namedItem("campaignId");
  if (templateCampaign instanceof HTMLSelectElement) templateCampaign.replaceChildren();
  if (campaignList.length === 0) { message(campaigns, "No feedback campaigns are configured for this workspace."); campaignSelect.disabled = true; templateForm.hidden = true; return; }
  campaignSelect.disabled = false;
  templateForm.hidden = false;
  for (const campaign of campaignList) {
    const option = document.createElement("option"); option.value = campaign.id; option.textContent = `${campaign.id} · v${campaign.templateVersion}`; campaignSelect.append(option);
    if (templateCampaign instanceof HTMLSelectElement) { const templateOption = option.cloneNode(true) as HTMLOptionElement; templateCampaign.append(templateOption); }
    const card = document.createElement("article"); card.className = "campaign-card";
    card.innerHTML = `<div><p class="eyebrow">Campaign</p><h2></h2></div><div class="campaign-card-actions"><span class="campaign-status"></span><button type="button" class="campaign-toggle account-button"></button></div><dl><div><dt>Audience</dt><dd></dd></div><div><dt>Frequency cap</dt><dd>${campaign.frequencyCapDays} days</dd></div><div><dt>Expires after</dt><dd>${campaign.expiresAfterDays} days</dd></div></dl>`;
    const title = card.querySelector("h2"); if (title) title.textContent = campaign.id;
    const state = card.querySelector(".campaign-status"); if (state) { state.textContent = campaign.enabled ? "Enabled" : "Paused"; state.classList.toggle("enabled", campaign.enabled); }
    const toggle = card.querySelector<HTMLButtonElement>(".campaign-toggle"); if (toggle) { toggle.textContent = campaign.enabled ? "Pause" : "Enable"; toggle.addEventListener("click", async () => { toggle.disabled = true; const result = await setFeedbackCampaignStatus(window.fetch.bind(window), apiBase, tenantId, campaign.id, !campaign.enabled); toggle.disabled = false; if (result.kind !== "ready") return setStatus(result.kind, result.message); campaignList = campaignList.map((item) => item.id === campaign.id ? { ...item, enabled: result.enabled } : item); renderCampaigns(); setStatus("ready", `${campaign.id} is ${result.enabled ? "enabled" : "paused"}.`); }); }
    const audience = card.querySelector("dd"); if (audience) audience.textContent = audienceLabel(campaign.audience);
    campaigns.append(card);
  }
}

function setTemplateDefaults(): void {
  const campaign = campaignList.find((item) => item.id === campaignSelect.value) ?? campaignList[0];
  if (!campaign) return;
  const campaignField = templateForm.elements.namedItem("campaignId");
  const versionField = templateForm.elements.namedItem("version");
  if (campaignField instanceof HTMLSelectElement) campaignField.value = campaign.id;
  if (versionField instanceof HTMLInputElement) versionField.value = String(campaign.templateVersion + 1);
}

function syncPresentationFields(): void {
  const guided = presentation.value === "steps";
  questionsPerStep.hidden = !guided;
  const field = templateForm.elements.namedItem("questionsPerStep");
  if (field instanceof HTMLInputElement) field.disabled = !guided;
}

function templateDraft(): { campaignId: string; version: number; title: string; intro: string; presentation: "compact" | "steps" | "conversation"; questionsPerStep: number | null; questions: readonly QuestionDraft[] } {
  const read = (name: string): string => { const value = templateForm.elements.namedItem(name); if (!(value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement || value instanceof HTMLSelectElement)) throw new Error(`Missing template field: ${name}`); return value.value.trim(); };
  const rows = [...questions.querySelectorAll<HTMLElement>("[data-question-id]")];
  if (rows.length === 0) throw new Error("Templates need at least one question.");
  const questionsValue = rows.map((row): QuestionDraft => { const type = row.querySelector<HTMLSelectElement>("[data-field=type]")?.value; const prompt = row.querySelector<HTMLInputElement>("[data-field=prompt]")?.value.trim() ?? ""; const required = row.querySelector<HTMLInputElement>("[data-field=required]")?.checked === true; const choices = row.querySelector<HTMLInputElement>("[data-field=choices]")?.value.split(",").map((choice) => choice.trim()).filter(Boolean) ?? []; if (type !== "rating" && type !== "text" && type !== "choice") throw new Error("Choose a valid question type."); return { id: row.dataset.questionId ?? "", type, prompt, required, choices: type === "choice" ? choices : [] }; });
  const mode = presentation.value;
  if (mode !== "compact" && mode !== "steps" && mode !== "conversation") throw new Error("Choose a valid client experience.");
  const stepSize = mode === "steps" ? Number(read("questionsPerStep")) : null;
  return { campaignId: read("campaignId"), version: Number(read("version")), title: read("title"), intro: read("intro"), presentation: mode, questionsPerStep: stepSize, questions: questionsValue };
}

addQuestion.addEventListener("click", () => { questionDrafts = [...questionDrafts, { id: `question-${crypto.randomUUID()}`, type: "text", prompt: "", required: false, choices: [] }]; renderQuestions(); });
presentation.addEventListener("change", syncPresentationFields);

campaignForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!tenantId) return setStatus("denied", "Choose an authorized workspace before creating a campaign.");
  const read = (name: string): string => { const field = campaignForm.elements.namedItem(name); if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) throw new Error(`Missing campaign field: ${name}`); return field.value.trim(); };
  const audience = read("audience");
  if (audience !== "any-client" && audience !== "completed-appointment" && audience !== "campaign") return setStatus("error", "Choose a valid campaign audience.");
  try {
    setStatus("loading", "Creating feedback campaign...");
    const result = await createFeedbackCampaign(window.fetch.bind(window), apiBase, tenantId, { id: read("campaignId"), enabled: false, audience, templateVersion: Number(read("templateVersion")), frequencyCapDays: Number(read("frequencyCapDays")), expiresAfterDays: Number(read("expiresAfterDays")) });
    if (result.kind !== "ready") return setStatus(result.kind, result.message);
    campaignForm.reset();
    const campaignsState = await fetchFeedbackCampaigns(window.fetch.bind(window), apiBase, tenantId);
    if (campaignsState.kind === "ready") { campaignList = campaignsState.campaigns; renderCampaigns(); }
    setStatus("ready", `Campaign ${result.campaign.id} created paused. Add its template, then enable it when ready.`);
  } catch (error) { setStatus("error", error instanceof Error ? error.message : "Feedback campaign could not be created."); }
});

templateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!tenantId) return setStatus("denied", "Choose an authorized workspace before creating a template version.");
  try {
    setStatus("loading", "Creating template version...");
    const result = await createFeedbackTemplate(window.fetch.bind(window), apiBase, tenantId, templateDraft());
    if (result.kind === "ready") setStatus("ready", `Template version ${result.template.version} created. Campaign activation remains a separate policy step.`);
    else setStatus(result.kind, result.message);
  } catch (error) { setStatus("error", error instanceof Error ? error.message : "Template version could not be created."); }
});

function renderAnalytics(value: NonNullable<FeedbackAnalyticsResponse["data"]>): void {
  clear(analytics);
  const metrics = document.createElement("div"); metrics.className = "feedback-metrics";
  const values: [string, string][] = [["Responses", String(value.responseCount)], ["Average rating", value.averageRating === null ? "—" : value.averageRating.toFixed(2)], ["Rated responses", String(value.ratingCount)]];
  for (const [label, number] of values) { const item = document.createElement("div"); item.className = "feedback-metric"; item.innerHTML = `<span></span><strong></strong>`; item.querySelector("span")!.textContent = label; item.querySelector("strong")!.textContent = number; metrics.append(item); }
  analytics.append(metrics);
  const choices = Object.entries(value.choiceCounts);
  if (choices.length) { const heading = document.createElement("h3"); heading.textContent = "Choice trends"; analytics.append(heading); const list = document.createElement("dl"); list.className = "choice-trends"; for (const [question, counts] of choices) { const row = document.createElement("div"); row.innerHTML = `<dt></dt><dd></dd>`; row.querySelector("dt")!.textContent = question; row.querySelector("dd")!.textContent = Object.entries(counts).map(([choice, count]) => `${choice}: ${count}`).join(" · "); list.append(row); } analytics.append(list); }
}

function renderResponses(items: readonly FeedbackResponseSummary[]): void {
  clear(responses); if (items.length === 0) return message(responses, "No responses have been submitted for this campaign yet.");
  const list = document.createElement("div"); list.className = "response-list";
  for (const response of items) { const row = document.createElement("article"); row.className = "response-row"; const answerCount = Object.keys(response.answers).length; row.innerHTML = `<div><strong>Response received</strong><span>Template version ${response.templateVersion}</span></div><div><strong>${answerCount} answers</strong><span></span></div>`; row.querySelectorAll("span")[1]!.textContent = new Date(response.submittedAt).toLocaleString(); list.append(row); }
  responses.append(list);
}

async function loadCampaign(campaignId: string): Promise<void> {
  const campaign = campaignList.find((item) => item.id === campaignId); if (!campaign) return;
  message(analytics, "Loading aggregate insights...", "loading"); message(responses, "Loading response summaries...", "loading");
  const [analyticsState, responseState] = await Promise.all([fetchFeedbackAnalytics(window.fetch.bind(window), apiBase, tenantId, campaign.id, campaign.templateVersion), fetchFeedbackResponses(window.fetch.bind(window), apiBase, tenantId, campaign.id)]);
  if (analyticsState.kind === "ready") renderAnalytics(analyticsState.analytics); else message(analytics, analyticsState.message, analyticsState.kind);
  if (responseState.kind === "ready") renderResponses(responseState.responses); else message(responses, responseState.message, responseState.kind);
}

campaignSelect.addEventListener("change", () => { setTemplateDefaults(); void loadCampaign(campaignSelect.value); });

if (!tenantId) setStatus("denied", "Choose an authorized workspace to view feedback reporting.");
else { setStatus("loading", "Loading feedback campaigns..."); renderQuestions(); syncPresentationFields(); fetchFeedbackCampaigns(window.fetch.bind(window), apiBase, tenantId).then((state) => { if (state.kind !== "ready") return setStatus(state.kind, state.message); campaignList = state.campaigns; renderCampaigns(); setStatus("ready", campaignList.length ? "Feedback reporting is ready." : "Feedback reporting is ready; no campaigns are configured."); if (campaignList[0]) { campaignSelect.value = campaignList[0].id; setTemplateDefaults(); void loadCampaign(campaignList[0].id); } }).catch(() => setStatus("error", "Feedback campaigns could not be loaded.")); }
