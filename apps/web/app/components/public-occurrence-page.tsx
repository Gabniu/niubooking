// Ownership: public capacity reservation conversation; occurrence capacity remains server-authoritative.
"use client";

import { useEffect, useState } from "react";
import { createGuestOccurrenceReservation, fetchGuestOccurrences } from "../../src/guest-booking-client.js";
import { apiBase } from "./workspace-admission.js";

type Occurrence = { id: string; label: string; startsAt: string; endsAt: string; capacity: number | null; remainingCapacity: number | null };
type State = { kind: "loading" | "ready" | "error" | "unavailable" | "success"; message?: string };
const browserFetcher = (input: string, init?: { method?: "POST"; headers?: Record<string, string>; body?: string }) => window.fetch(input, init);
function timeLabel(occurrence: Occurrence): string { const start = new Date(occurrence.startsAt); const end = new Date(occurrence.endsAt); return `${occurrence.label} · ${start.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} – ${end.toLocaleTimeString([], { timeStyle: "short" })}`; }
function capacityLabel(occurrence: Occurrence): string { return occurrence.remainingCapacity === null ? "Open availability" : `${occurrence.remainingCapacity} place${occurrence.remainingCapacity === 1 ? "" : "s"} left`; }

export function PublicOccurrencePage({ code }: { code: string }) {
  const [state, setState] = useState<State>(() => !code ? { kind: "error", message: "This booking link is missing its code." } : !apiBase ? { kind: "unavailable", message: "Booking is temporarily unavailable. Please try again later." } : { kind: "loading", message: "Loading published times…" });
  const [occurrences, setOccurrences] = useState<readonly Occurrence[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [channel, setChannel] = useState("");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!code || !apiBase) return;
    let cancelled = false;
    void fetchGuestOccurrences(browserFetcher, apiBase, code).then((result) => {
      if (cancelled) return;
      if (result.kind !== "ready") return setState(result);
      setOccurrences(result.value); setSelected(result.value[0]?.id ?? "");
      setState(result.value.length ? { kind: "ready", message: "Choose a published time, then tell us how to recognise your reservation." } : { kind: "unavailable", message: "There are no published places available right now." });
    }).catch(() => { if (!cancelled) setState({ kind: "error", message: "We could not load the available sessions. Please try again." }); });
    return () => { cancelled = true; };
  }, [code]);

  async function reserve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const places = Number(quantity);
    if (!selected || !name.trim() || !Number.isInteger(places) || places < 1) return setState({ kind: "error", message: "Choose a time and provide your name and number of places." });
    if (contact.trim() && (!channel || !consent)) return setState({ kind: "error", message: "Choose a reminder channel and agree to reminders before adding contact details." });
    setPending(true); setState({ kind: "loading", message: "Confirming your place…" });
    try {
      const result = await createGuestOccurrenceReservation(browserFetcher, apiBase, code, selected, { customerName: name.trim(), quantity: places, idempotencyKey: crypto.randomUUID(), ...(contact.trim() && channel ? { contact: { channel: channel as "email" | "sms" | "voice", destination: contact.trim(), consentGranted: true } } : {}) });
      if (result.kind !== "ready") return setState(result);
      setState({ kind: "success", message: `Reserved ${result.value.quantity} place${result.value.quantity === 1 ? "" : "s"}. You are all set.` });
    } catch { setState({ kind: "error", message: "We could not reserve that place. Please try again." }); } finally { setPending(false); }
  }

  const chosen = occurrences.find((item) => item.id === selected);
  return <main className="public-occurrence-page"><header className="public-occurrence-header"><a href="/" className="public-occurrence-brand" aria-label="Niu Booking home"><span className="public-occurrence-mark" aria-hidden="true">N</span><span>Niu <strong>Booking</strong></span></a><span>Public booking</span></header><section className="public-occurrence-card" aria-labelledby="occurrence-title"><p className="public-eyebrow">RESERVE A PLACE</p><h1 id="occurrence-title">Choose a published time</h1><p className="public-occurrence-intro">Reserve a place for a class, trip, lesson, or other scheduled service.</p>{state.message && <p className={`public-occurrence-status public-occurrence-status-${state.kind}`} role="status" aria-live="polite">{state.message}</p>}{state.kind === "ready" && <form className="public-occurrence-form" onSubmit={(event) => void reserve(event)}><label>Published time<select required value={selected} onChange={(event) => setSelected(event.target.value)} disabled={pending}>{occurrences.map((occurrence) => <option key={occurrence.id} value={occurrence.id} disabled={occurrence.remainingCapacity === 0}>{timeLabel(occurrence)} · {capacityLabel(occurrence)}</option>)}</select></label>{chosen && <p className="public-occurrence-help">{capacityLabel(chosen)}. Please reserve only the places you need.</p>}<label>Your name<input required maxLength={200} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} disabled={pending} /></label><label>Places<input required type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={pending} /></label><label>Reminders <span className="public-occurrence-optional">optional</span><select value={channel} onChange={(event) => setChannel(event.target.value)} disabled={pending}><option value="">No reminders</option><option value="email">Email</option><option value="sms">SMS</option><option value="voice">Voice call</option></select></label>{channel && <><label>Contact<input placeholder="Email or phone" autoComplete="email tel" maxLength={320} value={contact} onChange={(event) => setContact(event.target.value)} disabled={pending} /></label><label className="public-occurrence-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={pending} /><span>I agree to receive reminders.</span></label></>}<button className="public-occurrence-primary" type="submit" disabled={pending}>{pending ? "Confirming…" : "Reserve my place"}</button></form>}{state.kind === "success" && <div className="public-occurrence-success"><h2>Your place is reserved.</h2><p>{state.message}</p><a className="public-occurrence-secondary" href="/">Return to Niu Booking</a></div>}</section></main>;
}
