// Ownership: public contact verification UI; it never displays or accepts a destination.
"use client";

import { useState } from "react";
import { verifyContactChallenge, type ContactVerificationState } from "../../src/contact-verification-client.js";
import { apiBase } from "./workspace-admission.js";

type State = { kind: "ready" | "loading" | "error" | "unavailable" | "verified" | "invalid" | "expired" | "locked"; message: string };
const browserFetcher = (input: string, init: { method: "POST"; headers: Record<string, string>; body: string }) => window.fetch(input, init);
const messages: Record<ContactVerificationState["kind"], string> = { verified: "Contact method verified. You can close this page.", invalid: "That code is not valid. Check the message and try again.", expired: "That code has expired. Request a new code.", locked: "Too many attempts. Request a new code later.", error: "Verification is temporarily unavailable. Try again shortly." };

export function ContactVerificationPage({ challenge }: { challenge: string }) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>(() => !challenge ? { kind: "error", message: "This verification link is incomplete." } : !apiBase ? { kind: "unavailable", message: "Contact verification is temporarily unavailable. Please try again later." } : { kind: "ready", message: "Enter the six-digit code from your message." });
  const verified = state.kind === "verified";

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return setState({ kind: "error", message: "This verification link is incomplete." });
    if (!/^\d{6}$/u.test(code)) return setState({ kind: "invalid", message: "Enter the six-digit code from your message." });
    setState({ kind: "loading", message: "Checking your code…" });
    try {
      const result = await verifyContactChallenge(browserFetcher, apiBase, challenge, code);
      setState({ kind: result.kind, message: messages[result.kind] });
    } catch { setState({ kind: "error", message: "Verification is temporarily unavailable. Try again shortly." }); }
  }

  return <main className="contact-verification-page"><header className="contact-verification-header"><a href="/" className="contact-verification-brand" aria-label="Niu Booking home"><span className="contact-verification-mark" aria-hidden="true">N</span><span>Niu <strong>Booking</strong></span></a><span>Secure contact verification</span></header><section className="contact-verification-card" aria-labelledby="verification-title"><p className="public-eyebrow">SECURE CONTACT VERIFICATION</p><h1 id="verification-title">Confirm this contact method</h1><p className="contact-verification-intro">Enter the six-digit code from your message. This link is short-lived and can only be used once.</p><p className={`contact-verification-status contact-verification-status-${state.kind}`} role="status" aria-live="polite">{state.message}</p>{!verified && <form className="contact-verification-form" onSubmit={(event) => void verify(event)}><label htmlFor="verification-code">Verification code<input id="verification-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/gu, "").slice(0, 6))} disabled={state.kind === "loading" || state.kind === "unavailable"} autoFocus /></label><button className="contact-verification-primary" type="submit" disabled={state.kind === "loading" || state.kind === "unavailable"}>{state.kind === "loading" ? "Checking…" : "Verify contact method"}</button></form>}{verified && <a className="contact-verification-secondary" href="/">Return to Niu Booking</a>}</section></main>;
}
