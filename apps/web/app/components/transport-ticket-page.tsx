// Ownership: public opaque-ticket view; tenant and passenger identity stay outside the browser contract.
"use client";

import { useEffect, useState } from "react";
import type { PublicTransportTicketSummary } from "@bookingapp/contracts";
import { fetchPublicTransportTicket } from "../../src/transport-public-client.js";
import { BookingIllustration } from "./booking-illustration.js";
import { TransportLiveTripStatus } from "./transport-live-trip-status.js";

type ViewState = { kind: "loading" | "ready" | "error" | "unavailable"; message?: string };
const browserFetcher = (input: string) => window.fetch(input);

function dateText(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Time to be confirmed" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
function money(value: number, currency: string): string { return new Intl.NumberFormat([], { style: "currency", currency, maximumFractionDigits: 2 }).format(value / 100); }

export function TransportTicketPage({ token, apiBase }: { token: string; apiBase: string }) {
  const [ticket, setTicket] = useState<PublicTransportTicketSummary | null>(null);
  const [state, setState] = useState<ViewState>(() => !token ? { kind: "error", message: "This ticket link is missing its token." } : !apiBase ? { kind: "unavailable", message: "Ticket lookup is temporarily unavailable. Please try again later." } : { kind: "loading" });
  useEffect(() => {
    if (!token || !apiBase) return;
    let active = true;
    void fetchPublicTransportTicket(browserFetcher, apiBase, token).then((result) => { if (!active) return; if (result.kind === "ready") { setTicket(result.value); setState({ kind: "ready" }); } else setState({ kind: result.kind, message: result.message }); });
    return () => { active = false; };
  }, [apiBase, token]);
  return <main className="transport-ticket-page"><header className="transport-header"><a className="transport-brand" href="/" aria-label="Niu Booking home"><span className="transport-brand-mark" aria-hidden="true">N</span><span>Niu <strong>Booking</strong></span></a><span className="transport-audience">Your travel ticket</span></header><section className="transport-ticket-shell" aria-labelledby="ticket-title"><div className="transport-ticket-heading"><p className="public-eyebrow">TRAVEL DETAILS</p><h1 id="ticket-title">Your ticket</h1><p>Keep this page ready when you arrive for boarding.</p></div>{state.message && <p className={`transport-status transport-status-${state.kind}`} role="status" aria-live="polite">{state.message}</p>}{state.kind === "loading" && <div className="transport-loading" aria-label="Loading ticket"><span /><span /><span /></div>}{state.kind === "error" || state.kind === "unavailable" ? <section className="transport-ticket-empty"><BookingIllustration id="booked" alt="" /><h2>Ticket unavailable</h2><p>Open the ticket link again or ask the operator to send a new one.</p><a className="transport-secondary" href="/">Return to Niu Booking</a></section> : ticket && <><section className="transport-ticket-card"><div className="transport-ticket-card-top"><div><p className="public-eyebrow">{ticket.status === "issued" ? "CONFIRMED TICKET" : "TICKET CANCELLED"}</p><h2>{ticket.routeName}</h2></div><span className={`transport-ticket-badge transport-ticket-badge-${ticket.status}`}>{ticket.status === "issued" ? "Issued" : "Cancelled"}</span></div><div className="transport-ticket-route"><div><span>From</span><strong>{ticket.originStopId}</strong></div><span className="transport-ticket-route-arrow" aria-hidden="true">-&gt;</span><div><span>To</span><strong>{ticket.destinationStopId}</strong></div></div><dl className="transport-ticket-details"><div><dt>Boarding</dt><dd>{dateText(ticket.boardingStartsAt)}</dd></div><div><dt>Boarding closes</dt><dd>{dateText(ticket.boardingEndsAt)}</dd></div><div><dt>Passengers</dt><dd>{ticket.quantity}</dd></div>{ticket.seatLabels?.length ? <div><dt>Seats</dt><dd>{ticket.seatLabels.join(", ")}</dd></div> : null}<div><dt>Fare</dt><dd>{money(ticket.fareAmountMinor, ticket.fareCurrency)}</dd></div></dl><p className="transport-ticket-note">Show this ticket to the operator. Your name and contact details are not displayed here.</p></section>{ticket.status === "issued" && <TransportLiveTripStatus token={token} apiBase={apiBase} geometry={ticket.geometry} stops={ticket.stops} />}</>}<a className="transport-secondary transport-ticket-back" href="/">Return to Niu Booking</a></section></main>;
}
