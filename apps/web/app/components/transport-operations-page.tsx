// Ownership: authenticated transport operations workspace; every list and mutation is tenant-admitted.
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { TransportManifestSummary, TransportRouteSummary, TransportTripSummary } from "@bookingapp/contracts";
import { fetchTransportManifest, fetchTransportRoutes, fetchTransportTrips } from "../../src/transport-staff-client.js";
import { AdmissionNotice, apiBase, useWorkspaceAdmission, WorkspacePicker } from "./workspace-admission.js";
import { WorkspaceShell } from "./workspace-shell.js";
import { TransportManifest } from "./transport-manifest.js";
import { TransportRouteForm } from "./transport-route-form.js";
import { TransportTripForm } from "./transport-trip-form.js";

type FetchState<T> =
  | { kind: "idle" | "loading" }
  | { kind: "ready"; value: readonly T[] }
  | { kind: "denied" | "error"; message: string };
type ManifestState =
  | { kind: "idle" | "loading"; value: readonly TransportManifestSummary[] }
  | { kind: "ready"; value: readonly TransportManifestSummary[] }
  | { kind: "denied" | "error"; value: readonly TransportManifestSummary[]; message: string };
const request = (input: string, init: { credentials: "include"; method?: "POST"; headers?: Record<string, string>; body?: string }) => window.fetch(input, init);

function dateLabel(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
function capacity(trip: TransportTripSummary): string { return trip.reservedQuantity === undefined ? `${trip.capacity} capacity` : `${trip.reservedQuantity}/${trip.capacity} reserved`; }

function RoutesList({ state }: { state: FetchState<TransportRouteSummary> }) {
  if (state.kind !== "ready") return state.kind === "error" || state.kind === "denied" ? <p className="surface-message error">{state.message}</p> : <p className="surface-message muted">Loading routes...</p>;
  if (!state.value.length) return <p className="surface-message muted">No routes yet. Add the first ordered route to plan a trip.</p>;
  return <div className="transport-route-list">{state.value.map((route) => <article className="transport-route-row" key={route.id}><div><strong>{route.name}</strong><small>{route.mode} - v{route.version} - {route.status}</small></div><span>{route.stops.map((stop) => stop.stopId).join(" -> ")}</span></article>)}</div>;
}

function TripsList({ state, selectedId, onSelect }: { state: FetchState<TransportTripSummary>; selectedId: string; onSelect: (tripId: string) => void }) {
  if (state.kind !== "ready") return state.kind === "error" || state.kind === "denied" ? <p className="surface-message error">{state.message}</p> : <p className="surface-message muted">Loading trips...</p>;
  if (!state.value.length) return <p className="surface-message muted">No trips match this window. Create a dated trip or widen the dates.</p>;
  return <div className="transport-trip-staff-list">{state.value.map((trip) => <button className={`transport-trip-staff-row${selectedId === trip.id ? " is-selected" : ""}`} type="button" key={trip.id} onClick={() => onSelect(trip.id)}><span><strong>{dateLabel(trip.boardingStartsAt)}</strong><small>Boarding until {dateLabel(trip.boardingEndsAt)}</small></span><span><strong>{trip.routeId}</strong><small>{trip.capacityMode} - {capacity(trip)}</small></span><span className="transport-row-arrow" aria-hidden="true">-&gt;</span></button>)}</div>;
}

export function TransportOperationsPage() {
  const { admission } = useWorkspaceAdmission();
  const [routes, setRoutes] = useState<FetchState<TransportRouteSummary>>({ kind: "idle" });
  const [trips, setTrips] = useState<FetchState<TransportTripSummary>>({ kind: "idle" });
  const [manifest, setManifest] = useState<ManifestState>({ kind: "idle", value: [] });
  const [selectedTripId, setSelectedTripId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState<{ text: string; kind: "error" | "ready" } | null>(null);
  const selectedTrip = useMemo(() => trips.kind === "ready" ? trips.value.find((trip) => trip.id === selectedTripId) ?? null : null, [selectedTripId, trips]);

  async function load(tenantId = admission.kind === "ready" ? admission.tenantId : "") {
    if (!tenantId) return;
    setRoutes({ kind: "loading" }); setTrips({ kind: "loading" });
    try { const [routeState, tripState] = await Promise.all([fetchTransportRoutes(request, apiBase, tenantId), fetchTransportTrips(request, apiBase, tenantId, from || undefined, to || undefined)]); setRoutes(routeState); setTrips(tripState); if (tripState.kind === "ready") setSelectedTripId((current) => tripState.value.some((trip) => trip.id === current) ? current : tripState.value[0]?.id ?? ""); }
    catch { const error = "Transport data could not be loaded. Check your connection and try again."; setRoutes({ kind: "error", message: error }); setTrips({ kind: "error", message: error }); }
  }
  useEffect(() => { if (admission.kind === "ready") void load(admission.tenantId); }, [admission]);
  async function selectTrip(tripId: string) { setSelectedTripId(tripId); if (admission.kind !== "ready") return; setManifest({ kind: "loading", value: [] }); try { const result = await fetchTransportManifest(request, apiBase, admission.tenantId, tripId); setManifest(result.kind === "ready" ? result : { ...result, value: [] }); } catch { setManifest({ kind: "error", value: [], message: "The trip manifest could not be loaded. Check your connection and try again." }); } }
  function submitDate(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (admission.kind === "ready") void load(admission.tenantId); }
  function setStaffMessage(text: string, kind: "error" | "ready" = "ready") { setMessage({ text, kind }); }
  function appendRoute(route: TransportRouteSummary) { setRoutes((state) => state.kind === "ready" ? { kind: "ready", value: [...state.value, route] } : state); }

  return <WorkspaceShell activeHref="/app/transport"><section className="workspace-content transport-staff-page"><header className="page-intro"><div><p className="eyebrow">Transport operations</p><h1>Routes and trips</h1><p className="intro-copy">Plan dated departures, check capacity, and board passengers from one admitted workspace.</p></div><button className="account-button" type="button" onClick={() => void load()} disabled={admission.kind !== "ready"}>Refresh</button></header>{admission.kind === "selecting" ? <WorkspacePicker workspaces={admission.workspaces} title="Choose a workspace for transport" /> : admission.kind !== "ready" ? <AdmissionNotice state={admission} title="Choose a workspace to manage transport" /> : <>{message && <p className={`transport-staff-message ${message.kind}`} role="status">{message.text}</p>}<div className="transport-staff-metrics"><article><span>Routes</span><strong>{routes.kind === "ready" ? routes.value.length : "-"}</strong></article><article><span>Trips in view</span><strong>{trips.kind === "ready" ? trips.value.length : "-"}</strong></article><article><span>Selected manifest</span><strong>{manifest.kind === "ready" ? manifest.value.length : "-"}</strong></article></div><form className="transport-date-toolbar" onSubmit={submitDate}><label>From<input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="account-button" type="submit">Apply window</button></form><div className="transport-staff-grid"><section className="transport-staff-card"><div className="transport-staff-card-heading"><div><p className="eyebrow">Route registry</p><h2>Routes</h2></div></div><RoutesList state={routes} /></section><section className="transport-staff-card"><div className="transport-staff-card-heading"><div><p className="eyebrow">Dispatch board</p><h2>Trips</h2></div></div><TripsList state={trips} selectedId={selectedTripId} onSelect={(tripId) => void selectTrip(tripId)} /></section></div><div className="transport-staff-grid transport-staff-grid-bottom"><TransportRouteForm tenantId={admission.tenantId} onCreated={appendRoute} onMessage={setStaffMessage} /><TransportTripForm tenantId={admission.tenantId} routes={routes.kind === "ready" ? routes.value : []} onCreated={() => void load(admission.tenantId)} onMessage={setStaffMessage} /></div><section className="transport-staff-card transport-manifest-card"><div className="transport-staff-card-heading"><div><p className="eyebrow">Conductor view</p><h2>{selectedTrip ? `Manifest - ${dateLabel(selectedTrip.boardingStartsAt)}` : "Select a trip"}</h2></div>{selectedTrip && <button className="account-button" type="button" onClick={() => void selectTrip(selectedTrip.id)}>Refresh manifest</button>}</div>{!selectedTrip ? <p className="surface-message muted">Choose a trip to load its passengers and ticket actions.</p> : manifest.kind === "loading" || manifest.kind === "idle" ? <p className="surface-message muted">Loading the manifest...</p> : manifest.kind === "error" || manifest.kind === "denied" ? <p className="surface-message error">{manifest.message}</p> : <TransportManifest tenantId={admission.tenantId} tripId={selectedTrip.id} capacityMode={selectedTrip.capacityMode} capacity={selectedTrip.capacity} entries={manifest.value} onMessage={setStaffMessage} />}</section></>}</section></WorkspaceShell>;
}
