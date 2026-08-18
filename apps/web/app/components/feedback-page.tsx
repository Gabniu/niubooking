// Ownership: tenant-scoped feedback campaigns, templates, and aggregate reporting.
"use client";

import { useEffect, useState } from "react";
import type { FeedbackAnalyticsResponse, FeedbackCampaignSummary, FeedbackPresentation, FeedbackResponseSummary } from "@bookingapp/contracts";
import { createFeedbackCampaign, fetchFeedbackCampaigns, setFeedbackCampaignStatus } from "../../src/feedback-admin-client.js";
import { fetchFeedbackAnalytics } from "../../src/feedback-analytics-client.js";
import { fetchFeedbackResponses } from "../../src/feedback-responses-client.js";
import { createFeedbackTemplate } from "../../src/feedback-template-client.js";
import { AdmissionNotice, apiBase, useWorkspaceAdmission, WorkspacePicker } from "./workspace-admission.js";
import { WorkspaceShell } from "./workspace-shell.js";

type DraftQuestion = { id: string; type: "rating" | "text" | "choice"; prompt: string; required: boolean; choices: string };
type ReportState = { analytics: NonNullable<FeedbackAnalyticsResponse["data"]> | null; responses: readonly FeedbackResponseSummary[]; loading: boolean; message: string | null };
type RequestInitLike = { credentials: "include"; method?: "POST"; headers?: Record<string, string>; body?: string };
const request = (input: string, init: RequestInitLike) => window.fetch(input, init);
const emptyQuestion = (): DraftQuestion => ({ id: crypto.randomUUID(), type: "rating", prompt: "", required: true, choices: "" });

function CampaignList({ campaigns, tenantId, onUpdated, onMessage }: { campaigns: readonly FeedbackCampaignSummary[]; tenantId: string; onUpdated: (campaignId: string, enabled: boolean) => void; onMessage: (message: string) => void }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  async function change(campaign: FeedbackCampaignSummary) {
    setPendingId(campaign.id);
    try {
      const result = await setFeedbackCampaignStatus(request, apiBase, tenantId, campaign.id, !campaign.enabled);
      if (result.kind === "ready") {
        onUpdated(campaign.id, result.enabled);
        onMessage(`${campaign.id} is now ${result.enabled ? "enabled" : "paused"}.`);
      } else {
        onMessage(result.message);
      }
    } catch {
      onMessage("Campaign status could not be updated. Please try again.");
    } finally {
      setPendingId(null);
    }
  }
  return <div className="feedback-campaign-list">{campaigns.map((campaign) => <article className="feedback-campaign" key={campaign.id}><div><p className="eyebrow">Campaign</p><h3>{campaign.id}</h3><dl><div><dt>Audience</dt><dd>{campaign.audience === "any-client" ? "Any client" : campaign.audience === "completed-appointment" ? "Completed appointment" : "Campaign / event"}</dd></div><div><dt>Frequency cap</dt><dd>{campaign.frequencyCapDays} days</dd></div><div><dt>Link expiry</dt><dd>{campaign.expiresAfterDays} days</dd></div></dl></div><div className="feedback-campaign-actions"><span className={`feedback-status${campaign.enabled ? " enabled" : ""}`}>{campaign.enabled ? "Enabled" : "Paused"}</span><button className="account-button" type="button" disabled={pendingId !== null} onClick={() => void change(campaign)}>{pendingId === campaign.id ? "Saving..." : campaign.enabled ? "Pause" : "Enable"}</button></div></article>)}</div>;
}

function QuestionEditor({ questions, onChange }: { questions: readonly DraftQuestion[]; onChange: (questions: readonly DraftQuestion[]) => void }) {
  function update(id: string, patch: Partial<DraftQuestion>) { onChange(questions.map((question) => question.id === id ? { ...question, ...patch } : question)); }
  return <div className="feedback-questions">{questions.map((question, index) => <article className="feedback-question" key={question.id}><div className="feedback-question-heading"><strong>Question {index + 1}</strong>{questions.length > 1 && <button className="quiet-danger-button" type="button" onClick={() => onChange(questions.filter((item) => item.id !== question.id))}>Remove</button>}</div><div className="feedback-question-fields"><label>Type<select value={question.type} onChange={(event) => update(question.id, { type: event.target.value as DraftQuestion["type"] })}><option value="rating">Rating</option><option value="text">Free text</option><option value="choice">Choice</option></select></label><label className="feedback-question-prompt">Prompt<input required maxLength={500} value={question.prompt} onChange={(event) => update(question.id, { prompt: event.target.value })} /></label><label className="feedback-required"><input type="checkbox" checked={question.required} onChange={(event) => update(question.id, { required: event.target.checked })} /> Required</label>{question.type === "choice" && <label>Choices<input required placeholder="Option 1, Option 2" value={question.choices} onChange={(event) => update(question.id, { choices: event.target.value })} /></label>}</div></article>)}</div>;
}

function Report({ state }: { state: ReportState }) {
  if (state.loading) return <p className="surface-message muted">Loading aggregate insights...</p>;
  if (state.message) return <p className="surface-message error">{state.message}</p>;
  if (!state.analytics) return <p className="surface-message muted">Select a campaign to view aggregate insights.</p>;
  const choices = Object.entries(state.analytics.choiceCounts);
  return <div className="feedback-report"><div className="feedback-metrics"><div><span>Responses</span><strong>{state.analytics.responseCount}</strong></div><div><span>Average rating</span><strong>{state.analytics.averageRating === null ? "-" : state.analytics.averageRating.toFixed(2)}</strong></div><div><span>Rated responses</span><strong>{state.analytics.ratingCount}</strong></div></div>{choices.length > 0 && <><h3>Choice trends</h3><dl className="feedback-choice-trends">{choices.map(([prompt, counts]) => <div key={prompt}><dt>{prompt}</dt><dd>{Object.entries(counts).map(([choice, count]) => `${choice}: ${count}`).join(" · ")}</dd></div>)}</dl></>}</div>;
}

export function FeedbackPage() {
  const { admission, retry } = useWorkspaceAdmission();
  const [campaigns, setCampaigns] = useState<readonly FeedbackCampaignSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState<{ kind: "loading" | "ready" | "error"; message: string } | null>(null);
  const [report, setReport] = useState<ReportState>({ analytics: null, responses: [], loading: false, message: null });
  const [questions, setQuestions] = useState<readonly DraftQuestion[]>([emptyQuestion()]);
  const [presentation, setPresentation] = useState<FeedbackPresentation>("conversation");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"campaign" | "template" | null>(null);

  useEffect(() => { if (admission.kind !== "ready") return; setStatus({ kind: "loading", message: "Loading feedback campaigns..." }); void fetchFeedbackCampaigns(request, apiBase, admission.tenantId).then((result) => { if (result.kind !== "ready") return setStatus({ kind: "error", message: result.message }); setCampaigns(result.campaigns); setSelectedId(result.campaigns[0]?.id ?? ""); setStatus({ kind: "ready", message: result.campaigns.length ? "Feedback management is ready." : "No feedback campaigns are configured yet." }); }).catch(() => setStatus({ kind: "error", message: "Feedback campaigns could not be loaded." })); }, [admission]);
  useEffect(() => { const campaign = campaigns.find((item) => item.id === selectedId); if (!campaign || admission.kind !== "ready") return; setReport({ analytics: null, responses: [], loading: true, message: null }); void Promise.all([fetchFeedbackAnalytics(request, apiBase, admission.tenantId, campaign.id, campaign.templateVersion), fetchFeedbackResponses(request, apiBase, admission.tenantId, campaign.id)]).then(([analytics, responses]) => setReport({ analytics: analytics.kind === "ready" ? analytics.analytics : null, responses: responses.kind === "ready" ? responses.responses : [], loading: false, message: analytics.kind !== "ready" ? analytics.message : responses.kind !== "ready" ? responses.message : null })).catch(() => setReport({ analytics: null, responses: [], loading: false, message: "Feedback insights could not be loaded." })); }, [admission, campaigns, selectedId]);

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (admission.kind !== "ready" || pendingAction) return;
    const formElement = event.currentTarget; const form = new FormData(formElement);
    setPendingAction("campaign"); setMessage(null);
    try {
      const result = await createFeedbackCampaign(request, apiBase, admission.tenantId, { id: String(form.get("campaignId")).trim(), enabled: false, audience: String(form.get("audience")) as "any-client" | "completed-appointment" | "campaign", templateVersion: Number(form.get("templateVersion")), frequencyCapDays: Number(form.get("frequencyCapDays")), expiresAfterDays: Number(form.get("expiresAfterDays")) });
      if (result.kind !== "ready") return setMessage(result.message);
      setMessage(`Campaign ${result.campaign.id} was created paused.`); formElement.reset(); setSelectedId(result.campaign.id);
      const loaded = await fetchFeedbackCampaigns(request, apiBase, admission.tenantId);
      if (loaded.kind === "ready") setCampaigns(loaded.campaigns); else setMessage(`Campaign ${result.campaign.id} was created. Refresh to see it in the list.`);
    } catch { setMessage("Campaign could not be created. Please try again."); } finally { setPendingAction(null); }
  }

  async function createTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (admission.kind !== "ready" || pendingAction) return;
    const formElement = event.currentTarget; const form = new FormData(formElement); const campaign = selectedId || String(form.get("campaignId"));
    setPendingAction("template"); setMessage(null);
    try {
      const result = await createFeedbackTemplate(request, apiBase, admission.tenantId, { campaignId: campaign, version: Number(form.get("version")), title: String(form.get("title")).trim(), intro: String(form.get("intro")).trim(), presentation, questionsPerStep: presentation === "steps" ? Number(form.get("questionsPerStep")) : null, questions: questions.map((question) => ({ id: question.id, type: question.type, prompt: question.prompt.trim(), required: question.required, choices: question.type === "choice" ? question.choices.split(",").map((choice) => choice.trim()).filter(Boolean) : [] })) });
      if (result.kind !== "ready") return setMessage(result.message);
      setCampaigns((items) => items.map((item) => item.id === result.template.campaignId ? { ...item, templateVersion: result.template.version } : item));
      setMessage(`Template version ${result.template.version} was saved.`); setQuestions([emptyQuestion()]); formElement.reset();
    } catch { setMessage("Template could not be saved. Please try again."); } finally { setPendingAction(null); }
  }

  const responseContent = report.responses.length ? <div className="feedback-response-list">{report.responses.map((item) => <article key={item.capabilityId}><strong>{Object.keys(item.answers).length} answers</strong><span>Template v{item.templateVersion} · {new Date(item.submittedAt).toLocaleString()}</span></article>)}</div> : <p className="surface-message muted">No responses have been submitted for this campaign yet.</p>;
  return <WorkspaceShell activeHref="/app/feedback"><section className="workspace-content feedback-page"><header className="page-intro"><div><p className="eyebrow">Client experience</p><h1>Feedback</h1><p className="intro-copy">Shape better service with privacy-safe campaigns and aggregate sentiment.</p></div><button className="account-button" type="button" onClick={retry}>Refresh</button></header>{admission.kind === "selecting" ? <WorkspacePicker workspaces={admission.workspaces} title="Choose a workspace for feedback" /> : admission.kind !== "ready" ? <AdmissionNotice state={admission} title="Choose a workspace to manage feedback" /> : <>{status && <p className={`feedback-status-message ${status.kind}`} role="status">{status.message}</p>}{message && <p className="feedback-message" role="status">{message}</p>}<div className="feedback-grid"><form className="feedback-card" aria-busy={pendingAction === "campaign"} onSubmit={(event) => void createCampaign(event)}><div className="card-heading"><div><p className="eyebrow">Campaign policy</p><h2>Create a campaign</h2></div></div><div className="feedback-form-grid"><label>Campaign ID<input name="campaignId" required placeholder="post-visit" /></label><label>Audience<select name="audience"><option value="any-client">Any client</option><option value="completed-appointment">Completed appointment</option><option value="campaign">Campaign / event</option></select></label><label>Template version<input name="templateVersion" type="number" min="1" defaultValue="1" required /></label><label>Frequency cap (days)<input name="frequencyCapDays" type="number" min="1" defaultValue="30" required /></label><label>Link expiry (days)<input name="expiresAfterDays" type="number" min="1" defaultValue="14" required /></label></div><button className="primary-button" type="submit" disabled={pendingAction !== null}>{pendingAction === "campaign" ? "Creating..." : "Create campaign"}</button></form><section className="feedback-card"><div className="card-heading"><div><p className="eyebrow">Configured campaigns</p><h2>Campaigns</h2></div><select aria-label="Select feedback campaign" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={!campaigns.length || pendingAction !== null}><option value="">Select a campaign</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.id}</option>)}</select></div>{campaigns.length ? <CampaignList campaigns={campaigns} tenantId={admission.tenantId} onUpdated={(id, enabled) => setCampaigns((items) => items.map((item) => item.id === id ? { ...item, enabled } : item))} onMessage={setMessage} /> : <p className="surface-message muted">Create a campaign to start collecting feedback.</p>}</section></div><form className="feedback-card" aria-busy={pendingAction === "template"} onSubmit={(event) => void createTemplate(event)}><div className="card-heading"><div><p className="eyebrow">Versioned authoring</p><h2>Create a template version</h2></div><span className="privacy-note">No question-count cap</span></div><div className="feedback-form-grid"><label>Campaign<select name="campaignId" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} required><option value="">Select a campaign</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.id}</option>)}</select></label><label>Version<input name="version" type="number" min="1" defaultValue={campaigns.find((item) => item.id === selectedId)?.templateVersion ? campaigns.find((item) => item.id === selectedId)!.templateVersion + 1 : 1} required /></label><label>Title<input name="title" required maxLength={160} /></label><label>Introduction<textarea name="intro" rows={2} maxLength={1000} /></label><label>Client experience<select value={presentation} onChange={(event) => setPresentation(event.target.value as FeedbackPresentation)}><option value="conversation">Conversation · one at a time</option><option value="steps">Guided steps</option><option value="compact">Compact scroll</option></select></label>{presentation === "steps" && <label>Questions per step<input name="questionsPerStep" type="number" min="1" defaultValue="3" required /></label>}</div><div className="question-header"><div><p className="eyebrow">Survey questions</p><h3>What should clients answer?</h3></div><button className="account-button" type="button" onClick={() => setQuestions([...questions, emptyQuestion()])} disabled={pendingAction !== null}>+ Add question</button></div><QuestionEditor questions={questions} onChange={setQuestions} /><button className="primary-button" type="submit" disabled={!campaigns.length || pendingAction !== null}>{pendingAction === "template" ? "Saving..." : "Save template version"}</button></form>{selectedId && <div className="feedback-grid"><section className="feedback-card"><div className="card-heading"><div><p className="eyebrow">Aggregate reporting</p><h2>Campaign insights</h2></div></div><Report state={report} /></section><section className="feedback-card"><div className="card-heading"><div><p className="eyebrow">Submission history</p><h2>Response summaries</h2></div><span className="privacy-note">Identities stay hidden</span></div>{responseContent}</section></div>}</>}</section></WorkspaceShell>;
}
