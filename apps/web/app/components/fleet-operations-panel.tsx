// Ownership: staff-only live fleet list and route context; identity fields stay server-side.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LiveVehicleProjection } from "@bookingapp/contracts";
import { endFleetTrip, fetchFleetCurrent, openFleetStream, type FleetEventSource, type FleetState } from "../../src/fleet-staff-client.js";
import { apiBase, useWorkspaceAdmission } from "./workspace-admission.js";
import { FleetOperationsMap } from "./fleet-operations-map.js";
import { filterFleetVehicles, FleetOperationsFilters, type FleetFilters } from "./fleet-operations-filters.js";
import { FleetTrackingHealth } from "./fleet-tracking-health.js";
import { FleetCrewStatus } from "./fleet-crew-status.js";

const request = (input: string, init: { credentials: "include" }) => window.fetch(input, init);
const commandRequest = (input: string, init: { credentials: "include"; method: "POST"; headers: { "content-type": "application/json" }; body: string }) => window.fetch(input, init);
const freshnessLabels: Record<LiveVehicleProjection["freshness"], string> = { live: "Live", delayed: "Delayed", signal_weak: "Weak signal", offline: "Offline" };

function VehicleMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 11 1.7-4.2A2 2 0 0 1 8.6 5.5h6.8a2 2 0 0 1 1.9 1.3L19 11m-14 0h14a2 2 0 0 1 2 2v3h-2m-16 0H3v-3a2 2 0 0 1 2-2Zm1 5h12M7 15.5h.01M17 15.5h.01" /></svg>;
}

function ageLabel(value: string | null, now: number): string {
  if (!value) return "No position received";
  const captured = new Date(value).getTime();
  if (!Number.isFinite(captured)) return "Time unavailable";
  const seconds = Math.max(0, Math.floor((now - captured) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function etaLabel(value: LiveVehicleProjection["eta"]): string {
  if (!value) return "Arrival estimate unavailable";
  const earliest = new Date(value.earliestArrival); const latest = new Date(value.latestArrival);
  if (Number.isNaN(earliest.getTime()) || Number.isNaN(latest.getTime())) return "Arrival estimate unavailable";
  const format = (date: Date, direction: "floor" | "ceil") => { const interval = 5 * 60_000; const rounded = new Date(direction === "floor" ? Math.floor(date.getTime() / interval) * interval : Math.ceil(date.getTime() / interval) * interval); return rounded.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };
  return `ETA ${format(earliest, "floor")}–${format(latest, "ceil")} · ${value.confidence} confidence`;
}

function VehicleRow({ vehicle, now, canStop, stopping, onStop }: { vehicle: LiveVehicleProjection; now: number; canStop: boolean; stopping: boolean; onStop: (tripId: string) => void }) {
  const freshness = freshnessLabels[vehicle.freshness];
  return <article className={`fleet-vehicle-row fleet-freshness-${vehicle.freshness}`}>
    <div className="fleet-vehicle-icon"><VehicleMark /></div>
    <div className="fleet-vehicle-main"><strong>{vehicle.vehicleLabel}</strong><span>{vehicle.routeLabel}</span><small>Trip {vehicle.tripId} · {etaLabel(vehicle.eta)}</small></div>
    <div className="fleet-vehicle-meta"><span className="fleet-freshness"><i aria-hidden="true" />{freshness}</span><time dateTime={vehicle.capturedAt ?? undefined}>{ageLabel(vehicle.capturedAt, now)}</time>{canStop && <button className="fleet-stop" type="button" onClick={() => onStop(vehicle.tripId)} disabled={stopping}>{stopping ? "Stopping…" : "Stop sharing"}</button>}</div>
  </article>;
}

function FleetSkeleton() {
  return <div className="fleet-skeleton" aria-label="Loading live vehicle locations" role="status"><span /><span /><span /></div>;
}

function FleetStateView({ state, onRetry }: { state: FleetState; onRetry: () => void }) {
  if (state.kind === "loading") return <FleetSkeleton />;
  if (state.kind !== "ready") return <div className="fleet-state fleet-state-error"><p>{state.message}</p><button className="fleet-retry" type="button" onClick={onRetry}>Try again</button></div>;
  if (!state.value.length) return <div className="fleet-state"><div className="fleet-empty-icon"><VehicleMark /></div><p>No vehicles are sharing location right now.</p><small>When a driver starts a trip, the vehicle will appear here with its last known update.</small></div>;
  return null;
}

function FleetFilterEmpty({ onReset }: { onReset: () => void }) {
  return <div className="fleet-state"><div className="fleet-empty-icon"><VehicleMark /></div><p>No vehicles match these filters.</p><small>Try another route, signal state, or search term.</small><button className="fleet-retry" type="button" onClick={onReset}>Clear filters</button></div>;
}

export function FleetOperationsPanel({ tenantId, role = "manager" }: { tenantId: string; role?: string }) {
  const { admission } = useWorkspaceAdmission();
  const [state, setState] = useState<FleetState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [filters, setFilters] = useState<FleetFilters>({ query: "", route: "all", freshness: "all" });
  const [stoppingTripId, setStoppingTripId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const load = useCallback(async () => { setRefreshing(true); try { setState(await fetchFleetCurrent(request, apiBase, tenantId)); } catch { setState({ kind: "error", message: "Live vehicle locations could not be loaded. Please try again." }); } finally { setRefreshing(false); setNow(Date.now()); } }, [tenantId]);
  useEffect(() => {
    void load();
    let streamActive = false;
    let closeStream = () => {};
    if (apiBase && typeof EventSource !== "undefined") {
      const factory = (url: string, init: { withCredentials: boolean }): FleetEventSource => new EventSource(url, init) as unknown as FleetEventSource;
      closeStream = openFleetStream(factory, apiBase, tenantId, (value) => { streamActive = true; setStreaming(true); setState({ kind: "ready", value }); setNow(Date.now()); }, () => { streamActive = true; setStreaming(true); void load(); }, () => { streamActive = false; setStreaming(false); });
    }
    const interval = window.setInterval(() => { if (document.visibilityState === "visible" && !streamActive) void load(); }, 30_000);
    const clock = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => { closeStream(); window.clearInterval(interval); window.clearInterval(clock); };
  }, [load, tenantId]);
  const readyVehicles = state.kind === "ready" ? state.value : [];
  const visibleVehicles = useMemo(() => filterFleetVehicles(readyVehicles, filters), [filters, readyVehicles]);
  const effectiveRole = admission.kind === "ready" && admission.tenantId === tenantId ? admission.role : role;
  const canStop = ["owner", "admin", "manager", "dispatcher"].includes(effectiveRole);
  const stopTrip = useCallback(async (tripId: string) => { setStoppingTripId(tripId); setActionMessage(null); try { const result = await endFleetTrip(commandRequest, apiBase, tenantId, tripId); if (result.kind === "success") { setActionMessage("Tracking stopped for this trip."); await load(); } else setActionMessage(result.message); } catch { setActionMessage("Tracking could not be stopped. Please try again."); } finally { setStoppingTripId(null); } }, [load, tenantId]);
  return <section className="fleet-operations-panel" aria-labelledby="fleet-panel-title"><FleetCrewStatus tenantId={tenantId} role={effectiveRole} /><header className="fleet-panel-heading"><div><p className="eyebrow">Live operations</p><h2 id="fleet-panel-title">Vehicles on the move</h2><p>Location updates are scoped to your current workspace.</p></div><div className="fleet-panel-actions"><span className="fleet-refresh-status" role="status">{refreshing ? "Updating" : streaming ? "Live connection" : "Checking every 30s"}</span><button className="fleet-refresh" type="button" onClick={() => void load()} disabled={refreshing}>{refreshing ? "Updating" : "Refresh"}</button></div></header><FleetStateView state={state} onRetry={() => void load()} />{actionMessage && <p className="fleet-action-message" role="status">{actionMessage}</p>}{readyVehicles.length > 0 && <><FleetOperationsFilters vehicles={readyVehicles} filters={filters} onChange={setFilters} onReset={() => setFilters({ query: "", route: "all", freshness: "all" })} resultCount={visibleVehicles.length} />{visibleVehicles.length > 0 ? <><FleetTrackingHealth vehicles={visibleVehicles} role={effectiveRole} /><FleetOperationsMap vehicles={visibleVehicles} /><div className="fleet-vehicle-list">{visibleVehicles.map((vehicle) => <VehicleRow key={`${vehicle.tripId}-${vehicle.vehicleLabel}`} vehicle={vehicle} now={now} canStop={canStop} stopping={stoppingTripId === vehicle.tripId} onStop={(tripId) => void stopTrip(tripId)} />)}</div></> : <FleetFilterEmpty onReset={() => setFilters({ query: "", route: "all", freshness: "all" })} />}</>}<footer className="fleet-panel-footnote"><span>{streaming ? "Live list" : "Fallback list"}</span><span>Route maps and list share the same workspace-scoped filters; arrival ranges appear when route data supports them.</span></footer></section>;
}
