// Ownership: assigned crew status is read-only here; device credentials remain in NIU Driver.
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchFleetCrewStatus, type FleetCrewStatusState } from "../../src/fleet-staff-client.js";
import { apiBase } from "./workspace-admission.js";

const request = (input: string, init: { credentials: "include" }) => window.fetch(input, init);

function sessionLabel(status: FleetCrewStatusState["kind"], active: boolean, role: "driver" | "conductor"): string {
  if (status === "loading") return "Checking status";
  if (active) return "Sharing location";
  return role === "driver" ? "Ready to share" : "Waiting for driver";
}

function expiryLabel(value: string): string {
  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) return "Expiry unavailable";
  return `Until ${expiresAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function FleetCrewStatus({ tenantId, role }: { tenantId: string; role: string }) {
  if (role !== "driver" && role !== "conductor") return null;
  return <FleetCrewStatusContent tenantId={tenantId} role={role} />;
}

function FleetCrewStatusContent({ tenantId, role }: { tenantId: string; role: "driver" | "conductor" }) {
  const [state, setState] = useState<FleetCrewStatusState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setRefreshing(true);
    try { setState(await fetchFleetCrewStatus(request, apiBase, tenantId)); }
    catch { setState({ kind: "error", message: "Your crew status could not be loaded. Please try again." }); }
    finally { setRefreshing(false); }
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);
  if (state.kind === "loading") return <section className="fleet-crew-status" aria-live="polite"><p className="eyebrow">Your crew status</p><p className="fleet-crew-muted">Checking assigned trips…</p></section>;
  if (state.kind !== "ready") return <section className="fleet-crew-status fleet-crew-status-error" role="status"><p>{state.message}</p><button className="fleet-retry" type="button" onClick={() => void load()} disabled={refreshing}>{refreshing ? "Checking…" : "Try again"}</button></section>;
  return <section className="fleet-crew-status" aria-labelledby="fleet-crew-status-title">
    <header className="fleet-crew-heading"><div><p className="eyebrow">Your crew status</p><h3 id="fleet-crew-status-title">Assigned trips</h3></div><button className="fleet-refresh" type="button" onClick={() => void load()} disabled={refreshing}>{refreshing ? "Checking…" : "Refresh"}</button></header>
    {state.value.length === 0 ? <p className="fleet-crew-muted">No active trip assignments yet.</p> : <div className="fleet-crew-list">{state.value.map((assignment) => { const active = Boolean(assignment.activeSession); return <article className="fleet-crew-row" key={assignment.assignmentId}><div><strong>Trip {assignment.tripId}</strong><span>{assignment.role === "driver" ? "Driver" : "Conductor"}</span></div><div className={`fleet-crew-state ${active ? "is-active" : ""}`}><b>{sessionLabel(state.kind, active, role)}</b>{active && assignment.activeSession ? <small>{expiryLabel(assignment.activeSession.expiresAt)}</small> : <small>{role === "driver" ? "Open NIU Driver to start sharing." : "The assigned driver starts sharing from NIU Driver."}</small>}</div></article>; })}</div>}
  </section>;
}
