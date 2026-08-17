// Ownership: public capability-authorized booking changes; no tenant data is accepted from the URL.
"use client";

import { useEffect, useState } from "react";
import { cancelManagedBooking, fetchManagedBooking, rescheduleManagedBooking } from "../../src/guest-booking-client.js";
import { apiBase } from "./workspace-admission.js";

type Booking = { serviceName: string; startsAt: string; endsAt: string; status: string };
type ViewState = { kind: "loading" | "error" | "unavailable" | "ready"; message?: string };

function localInput(iso: string): string { const date = new Date(iso); return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function summary(booking: Booking): string { const start = new Date(booking.startsAt); const end = new Date(booking.endsAt); return `${booking.serviceName} · ${start.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} – ${end.toLocaleTimeString([], { timeStyle: "short" })} · ${booking.status}`; }

export function ManageBookingPage({ token }: { token: string }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [state, setState] = useState<ViewState>(() => !token ? { kind: "error", message: "This booking link is missing its token." } : !apiBase ? { kind: "error", message: "Booking management is temporarily unavailable." } : { kind: "loading" });
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!token) return setState({ kind: "error", message: "This booking link is missing its token." });
    if (!apiBase) return setState({ kind: "error", message: "Booking management is temporarily unavailable." });
    let cancelled = false;
    void fetchManagedBooking(window.fetch.bind(window), apiBase, token).then((result) => { if (cancelled) return; if (result.kind === "ready") { setBooking(result.value); setStartsAt(localInput(result.value.startsAt)); setEndsAt(localInput(result.value.endsAt)); setState({ kind: "ready" }); } else setState({ kind: result.kind, message: result.message }); }).catch(() => { if (!cancelled) setState({ kind: "error", message: "Booking management is temporarily unavailable." }); });
    return () => { cancelled = true; };
  }, [token]);
  async function reschedule(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const starts = new Date(startsAt); const ends = new Date(endsAt); if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts || starts <= new Date()) return setState({ kind: "error", message: "Choose a future time, with the end after the start." }); setPending(true); setState({ kind: "loading", message: "Rescheduling your appointment..." }); try { const result = await rescheduleManagedBooking(window.fetch.bind(window), apiBase, token, { startsAt: starts.toISOString(), endsAt: ends.toISOString(), idempotencyKey: crypto.randomUUID() }); if (result.kind === "ready") { setBooking(result.value); setStartsAt(localInput(result.value.startsAt)); setEndsAt(localInput(result.value.endsAt)); setState({ kind: "ready", message: "Your appointment has been rescheduled." }); } else setState({ kind: result.kind, message: result.message }); } catch { setState({ kind: "error", message: "We could not reschedule this appointment. Please try again." }); } finally { setPending(false); } }
  async function cancel() { if (!window.confirm("Cancel this appointment?")) return; setPending(true); setState({ kind: "loading", message: "Cancelling your appointment..." }); try { const result = await cancelManagedBooking(window.fetch.bind(window), apiBase, token, crypto.randomUUID()); if (result.kind === "ready") { setBooking(result.value); setState({ kind: "ready", message: "Your appointment has been cancelled." }); } else setState({ kind: result.kind, message: result.message }); } catch { setState({ kind: "error", message: "We could not cancel this appointment. Please try again." }); } finally { setPending(false); } }
  const editable = booking?.status === "scheduled";
  return <main className="manage-page"><header className="manage-header"><a className="manage-brand" href="/"><span className="manage-brand-mark" aria-hidden="true">N</span><span>Niu <strong>Booking</strong></span></a><a className="manage-home" href="/">Niu Booking home</a></header><section className="manage-card" aria-labelledby="manage-title"><p className="public-eyebrow">MANAGE BOOKING</p><h1 id="manage-title">Change your appointment</h1>{booking ? <p className="manage-summary">{summary(booking)}</p> : <p className="manage-summary">Loading your booking...</p>}{state.message && <p className={`manage-status manage-status-${state.kind}`} role="status" aria-live="polite">{state.message}</p>}{editable && <form className="manage-form" onSubmit={(event) => void reschedule(event)}><label>New start<input type="datetime-local" required value={startsAt} onChange={(event) => setStartsAt(event.target.value)} disabled={pending} /></label><label>New end<input type="datetime-local" required value={endsAt} onChange={(event) => setEndsAt(event.target.value)} disabled={pending} /></label><div className="manage-actions"><button className="public-primary" type="submit" disabled={pending}>{pending ? "Saving..." : "Reschedule appointment"}</button><button className="public-secondary" type="button" onClick={() => void cancel()} disabled={pending}>Cancel appointment</button></div></form>}{booking && !editable && <p className="manage-closed">This appointment is already {booking.status}.</p>}</section></main>;
}
