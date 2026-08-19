// Ownership: staff manifest and conductor boarding controls; each mutation is idempotent and server-authorized.
"use client";

import { useState } from "react";
import type { TransportManifestSummary } from "@bookingapp/contracts";
import { assignTransportReservationSeats, boardTransportTicket } from "../../src/transport-staff-client.js";
import { apiBase } from "./workspace-admission.js";

type Props = { tenantId: string; tripId: string; capacityMode: "seat" | "open"; capacity: number; entries: readonly TransportManifestSummary[]; onMessage: (message: string, kind?: "error" | "ready") => void };

export function TransportManifest({ tenantId, tripId, capacityMode, capacity, entries, onMessage }: Props) {
  const [pendingTicket, setPendingTicket] = useState<string | null>(null);
  const [pendingReservation, setPendingReservation] = useState<string | null>(null);
  const [seatDrafts, setSeatDrafts] = useState<Record<string, string>>({});
  const [boarded, setBoarded] = useState<ReadonlySet<string>>(new Set());
  async function board(entry: TransportManifestSummary) { if (!entry.ticket || entry.ticket.status !== "issued") return; setPendingTicket(entry.ticket.id); try { const result = await boardTransportTicket(window.fetch.bind(window), apiBase, tenantId, tripId, entry.ticket.id, crypto.randomUUID()); if (result.kind !== "ready") return onMessage(result.message, "error"); setBoarded((current) => new Set(current).add(entry.ticket!.id)); onMessage("Passenger boarded and the action was recorded.", "ready"); } catch { onMessage("Boarding could not be completed. Check your connection and try again.", "error"); } finally { setPendingTicket(null); } }
  async function assignSeats(entry: TransportManifestSummary) {
    const value = seatDrafts[entry.reservation.id] ?? entry.reservation.seatLabels?.join(", ") ?? "";
    const labels = value.split(/[\s,]+/u).map((label) => label.trim()).filter(Boolean);
    if (labels.length !== entry.reservation.quantity) return onMessage("Enter one seat for each passenger.", "error");
    setPendingReservation(entry.reservation.id);
    try {
      const result = await assignTransportReservationSeats(window.fetch.bind(window), apiBase, tenantId, tripId, entry.reservation.id, labels);
      if (result.kind !== "ready") return onMessage(result.message, "error");
      setSeatDrafts((current) => ({ ...current, [entry.reservation.id]: result.value.seatLabels?.join(", ") ?? labels.join(", ") }));
      onMessage("Seats assigned and saved to the manifest.", "ready");
    } catch { onMessage("Seats could not be assigned. Check your connection and try again.", "error"); }
    finally { setPendingReservation(null); }
  }
  if (!entries.length) return <p className="surface-message muted">No passengers are on this manifest yet.</p>;
  return <div className="transport-manifest" aria-label="Trip manifest">{entries.map((entry) => { const ticket = entry.ticket; const isBoarded = Boolean(ticket && (boarded.has(ticket.id) || entry.reservation.status === "checked_in" || entry.reservation.status === "completed")); const seats = entry.reservation.seatLabels?.join(", "); return <article className="transport-manifest-row" key={entry.reservation.id}><div className="transport-manifest-person"><strong>{entry.reservation.customerId}</strong><small>{entry.reservation.originStopId} -&gt; {entry.reservation.destinationStopId} - {entry.reservation.quantity} passenger{entry.reservation.quantity === 1 ? "" : "s"}</small>{capacityMode === "seat" && <div className="transport-seat-controls"><label htmlFor={`seats-${entry.reservation.id}`}>Seats <span>1-{capacity}</span></label><div><input id={`seats-${entry.reservation.id}`} value={seatDrafts[entry.reservation.id] ?? seats ?? ""} onChange={(event) => setSeatDrafts((current) => ({ ...current, [entry.reservation.id]: event.target.value }))} placeholder="1, 2" inputMode="numeric" maxLength={entry.reservation.quantity * 5} disabled={pendingReservation !== null} /><button className="account-button" type="button" disabled={pendingReservation !== null || isBoarded} onClick={() => void assignSeats(entry)}>{pendingReservation === entry.reservation.id ? "Saving..." : seats ? "Update seats" : "Assign seats"}</button></div></div>}</div><span className={`transport-status-pill transport-status-${isBoarded ? "boarded" : entry.reservation.status}`}>{isBoarded ? "Boarded" : entry.reservation.status.replace("_", " ")}</span><span className="transport-ticket-state">{ticket ? ticket.status : "No ticket"}</span>{ticket?.status === "issued" && !isBoarded && <button className="account-button" type="button" disabled={pendingTicket !== null} onClick={() => void board(entry)}>{pendingTicket === ticket.id ? "Boarding..." : "Board"}</button>}{isBoarded && <span className="transport-boarded-mark" aria-label="Boarded">Checked</span>}</article>; })}</div>;
}
