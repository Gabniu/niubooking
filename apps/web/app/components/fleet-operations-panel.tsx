// Ownership: staff-only live fleet list; map and ETA stay deferred until their contracts are ready.
"use client";

import { useCallback, useEffect, useState } from "react";
import type { LiveVehicleProjection } from "@bookingapp/contracts";
import { fetchFleetCurrent, openFleetStream, type FleetEventSource, type FleetState } from "../../src/fleet-staff-client.js";
import { apiBase } from "./workspace-admission.js";

const request = (input: string, init: { credentials: "include" }) => window.fetch(input, init);
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

function VehicleRow({ vehicle, now }: { vehicle: LiveVehicleProjection; now: number }) {
  const freshness = freshnessLabels[vehicle.freshness];
  return <article className={`fleet-vehicle-row fleet-freshness-${vehicle.freshness}`}>
    <div className="fleet-vehicle-icon"><VehicleMark /></div>
    <div className="fleet-vehicle-main"><strong>{vehicle.vehicleLabel}</strong><span>{vehicle.routeLabel}</span><small>Trip {vehicle.tripId}</small></div>
    <div className="fleet-vehicle-meta"><span className="fleet-freshness"><i aria-hidden="true" />{freshness}</span><time dateTime={vehicle.capturedAt ?? undefined}>{ageLabel(vehicle.capturedAt, now)}</time></div>
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

export function FleetOperationsPanel({ tenantId }: { tenantId: string }) {
  const [state, setState] = useState<FleetState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [now, setNow] = useState(() => Date.now());
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
  return <section className="fleet-operations-panel" aria-labelledby="fleet-panel-title"><header className="fleet-panel-heading"><div><p className="eyebrow">Live operations</p><h2 id="fleet-panel-title">Vehicles on the move</h2><p>Location updates are scoped to your current workspace.</p></div><div className="fleet-panel-actions"><span className="fleet-refresh-status" role="status">{refreshing ? "Updating" : streaming ? "Live connection" : "Checking every 30s"}</span><button className="fleet-refresh" type="button" onClick={() => void load()} disabled={refreshing}>{refreshing ? "Updating" : "Refresh"}</button></div></header><FleetStateView state={state} onRetry={() => void load()} />{readyVehicles.length > 0 && <div className="fleet-vehicle-list">{readyVehicles.map((vehicle) => <VehicleRow key={`${vehicle.tripId}-${vehicle.vehicleLabel}`} vehicle={vehicle} now={now} />)}</div>}<footer className="fleet-panel-footnote"><span>{streaming ? "Live list" : "Fallback list"}</span><span>Map and ETA will appear when route geometry and prediction are enabled.</span></footer></section>;
}
