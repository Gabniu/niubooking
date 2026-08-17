// Ownership: public conversational feedback experience; survey presentation is creator-controlled.
"use client";

import { useEffect, useState } from "react";
import { fetchFeedback, submitFeedback } from "../../src/feedback-client.js";
import { createFeedbackForm, feedbackPages, validateFeedbackForm, type FeedbackAnswers, type FeedbackSurvey } from "../../src/feedback-form.js";
import { apiBase } from "./workspace-admission.js";

type State = { kind: "loading" | "ready" | "error" | "unavailable" | "submitted"; message?: string };
const browserFetcher = (input: string, init?: { method?: "POST"; headers?: Record<string, string>; body?: string }) => window.fetch(input, init);

function questionControl(question: FeedbackSurvey["questions"][number], answers: FeedbackAnswers, onChange: (value: string | number) => void) {
  if (question.type === "text") return <textarea aria-label={question.prompt} rows={4} value={String(answers[question.id] ?? "")} placeholder="Share what feels useful…" onChange={(event) => onChange(event.target.value)} />;
  const options = question.type === "rating" ? ["1", "2", "3", "4", "5"] : question.choices;
  return <div className="public-feedback-options" role="radiogroup" aria-label={question.prompt}>{options.map((option) => <label key={option}><input type="radio" name={question.id} value={option} checked={String(answers[question.id] ?? "") === option} onChange={() => onChange(question.type === "rating" ? Number(option) : option)} /><span>{question.type === "rating" ? `${option} / 5` : option}</span></label>)}</div>;
}

export function FeedbackExperience({ capability }: { capability: string }) {
  const [state, setState] = useState<State>(() => !capability ? { kind: "error", message: "This feedback link is missing its secure capability." } : !apiBase ? { kind: "unavailable", message: "Feedback is temporarily unavailable. Please try again later." } : { kind: "loading", message: "Opening your feedback conversation…" });
  const [survey, setSurvey] = useState<FeedbackSurvey | null>(null);
  const [pages, setPages] = useState<readonly FeedbackSurvey["questions"][]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState<FeedbackAnswers>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!capability || !apiBase) return;
    let cancelled = false;
    void fetchFeedback(browserFetcher, apiBase, capability).then((result) => {
      if (cancelled) return;
      if (result.kind !== "ready") return setState({ kind: result.kind === "submitted" ? "error" : result.kind, message: result.kind === "submitted" ? "This feedback form could not be opened." : result.message });
      const form = createFeedbackForm(result.survey);
      if (form.kind !== "ready" || result.survey.questions.length === 0) return setState({ kind: "error", message: "This feedback form has no questions yet." });
      setSurvey(result.survey); setPages(feedbackPages(result.survey)); setAnswers(form.answers); setState({ kind: "ready" });
    }).catch(() => { if (!cancelled) setState({ kind: "error", message: "We could not open this feedback form. Please try again." }); });
    return () => { cancelled = true; };
  }, [capability]);

  function setAnswer(id: string, value: string | number) { setAnswers((current) => ({ ...current, [id]: value })); }
  function continuePage() {
    if (!survey) return;
    const current = pages[pageIndex] ?? [];
    const errors = validateFeedbackForm({ ...survey, questions: current }, answers);
    if (errors.length) return setState({ kind: "error", message: errors[0] ?? "Please answer this question before continuing." });
    setState({ kind: "ready" }); setPageIndex((index) => index + 1);
  }
  async function send() {
    if (!survey) return;
    const errors = validateFeedbackForm(survey, answers);
    if (errors.length) return setState({ kind: "error", message: errors[0] ?? "Please answer the required questions before sending." });
    setPending(true); setState({ kind: "loading", message: "Sending your feedback…" });
    try {
      const result = await submitFeedback(browserFetcher, apiBase, capability, answers);
      if (result.kind === "submitted") return setState({ kind: "submitted", message: "Your feedback has been shared with the team." });
      if (result.kind === "unavailable" || result.kind === "error") setState({ kind: result.kind, message: result.message });
      else setState({ kind: "error", message: "This feedback link is no longer available." });
    } catch { setState({ kind: "error", message: "We could not send your feedback. Please try again." }); } finally { setPending(false); }
  }

  const page = pages[pageIndex] ?? [];
  const lastPage = pageIndex === pages.length - 1;
  return <main className="public-feedback-page"><header className="public-feedback-header"><a href="/" className="public-feedback-brand" aria-label="Niu Booking home"><span className="public-feedback-mark" aria-hidden="true">N</span><span>Niu <strong>Booking</strong></span></a><span>Feedback</span></header><section className="public-feedback-card" aria-labelledby="feedback-title"><p className="public-eyebrow">YOUR FEEDBACK MATTERS</p><h1 id="feedback-title">{survey?.title ?? "Tell us how we can improve"}</h1><p className="public-feedback-intro">{survey?.intro ?? "A short, thoughtful conversation with the team."}</p>{state.message && <p className={`public-feedback-status public-feedback-status-${state.kind}`} role="status" aria-live="polite">{state.message}</p>}{state.kind === "ready" && survey && <><div className="public-feedback-progress" aria-live="polite"><span>{survey.presentation === "compact" ? "A short survey" : `Question ${pageIndex + 1} of ${pages.length}`}</span><span>{Math.round(((pageIndex + 1) / pages.length) * 100)}%</span></div><form onSubmit={(event) => { event.preventDefault(); if (lastPage) void send(); else continuePage(); }}><p className="public-feedback-step">{survey.presentation === "conversation" && pageIndex > 0 ? "Thank you — one more thought." : survey.presentation === "conversation" ? "Let’s take this one question at a time." : "Take your time. You can move back before sending."}</p>{page.map((question) => <fieldset className="public-feedback-question" key={question.id}><legend>{question.prompt}{question.required && <span aria-label="required"> *</span>}</legend>{questionControl(question, answers, (value) => setAnswer(question.id, value))}</fieldset>)}<div className="public-feedback-actions">{pageIndex > 0 && <button className="public-feedback-secondary" type="button" onClick={() => { setState({ kind: "ready" }); setPageIndex((index) => index - 1); }} disabled={pending}>Back</button>}<button className="public-feedback-primary" type="submit" disabled={pending}>{pending ? "Sending…" : lastPage ? "Send feedback" : "Continue"}</button></div></form></>}{state.kind === "submitted" && <div className="public-feedback-success"><h2>Thank you for telling us.</h2><p>Your feedback has been shared with the team.</p><a className="public-feedback-secondary" href="/">Return to Niu Booking</a></div>}</section></main>;
}
