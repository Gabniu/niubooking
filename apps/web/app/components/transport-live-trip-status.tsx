// Ownership: ticket-scoped live status; no passenger, driver, or tenant identity is rendered.
"use client";

import { useEffect, useState } from "react";
import type { PublicTransportRouteGeometry, PublicTransportStopSummary, RiderLiveTripProjection } from "@bookingapp/contracts";
import { fetchPublicLiveSession, fetchPublicLiveTrip, openPublicLiveStream, type PublicTransportEventSource, type TransportState } from "../../src/transport-public-client.js";
import { TransportRouteMap } from "./transport-route-map.js";

const request = (input: string, init?: { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string }) => window.fetch(input, init);
const freshnessLabels: Record<RiderLiveTripProjection["freshness"], string> = { live: "Live", delayed: "Delayed", signal_weak: "Weak signal", offline: "Offline" };

function dateText(value: string | null): string { if (!value) return "No location received yet"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

export function TransportLiveTripStatus({ token, apiBase, geometry, stops }: { token: string; apiBase: string; geometry?: PublicTransportRouteGeometry | null | undefined; stops: readonly PublicTransportStopSummary[] }) {
  const [state, setState] = useState<TransportState<RiderLiveTripProjection>>(() => apiBase ? { kind: "error", message: "Loading live trip location..." } : { kind: "unavailable", message: "Live trip location is not configured for this ticket." });
  const [streaming, setStreaming] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    let active = true; let streamActive = false; let viewerToken = ""; let closeStream = () => {};
    const load = async () => { if (!viewerToken) return; const next = await fetchPublicLiveTrip(request, apiBase, viewerToken); if (active) setState(next); };
    const start = async () => {
      if (!apiBase || !token) return;
      const session = await fetchPublicLiveSession(request, apiBase, token);
      if (!active) return;
      if (session.kind !== "ready") { setState({ kind: session.kind, message: session.message }); return; }
      viewerToken = session.value.viewerToken;
      const first = await fetchPublicLiveTrip(request, apiBase, viewerToken);
      if (!active) return;
      setState(first);
      if (first.kind !== "ready" || typeof EventSource === "undefined") return;
      const factory = (url: string, init: { withCredentials: boolean }): PublicTransportEventSource => new EventSource(url, init) as unknown as PublicTransportEventSource;
      closeStream = openPublicLiveStream(factory, apiBase, viewerToken, (value) => { streamActive = true; setStreaming(true); setState({ kind: "ready", value }); }, () => { streamActive = true; setStreaming(true); void load(); }, () => { streamActive = false; setStreaming(false); });
    };
    void start();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible" && !streamActive) void load(); }, 30_000);
    return () => { active = false; closeStream(); window.clearInterval(interval); };
  }, [apiBase, retryKey, token]);
  const value = state.kind === "ready" ? state.value : null;
  return <section className="transport-live-trip" aria-labelledby="live-trip-title"><header><div><p className="public-eyebrow">LIVE TRIP</p><h2 id="live-trip-title">Vehicle location</h2></div>{value && <span className={`transport-live-badge transport-live-${value.freshness}`}>{freshnessLabels[value.freshness]}</span>}</header>{value && <div className="transport-live-details"><p>{value.latitude === null ? "Your operator has not shared a location yet." : "Your vehicle is sharing its latest location."}</p><dl><div><dt>Last update</dt><dd>{dateText(value.capturedAt)}</dd></div><div><dt>Connection</dt><dd>{streaming ? "Live updates" : "Checking periodically"}</dd></div></dl><TransportRouteMap geometry={geometry} stops={stops} livePosition={value} label="Live vehicle route" /></div>}{state.kind !== "ready" && <p className="transport-live-message" role="status" aria-live="polite">{state.message}</p>}{state.kind !== "ready" && <button className="transport-secondary transport-live-retry" type="button" onClick={() => setRetryKey((current) => current + 1)}>Try again</button>}<small>Vehicle position is shown only when the operator has shared a trusted location.</small></section>;
}
