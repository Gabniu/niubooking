// Ownership: ticket-scoped live status; no passenger, driver, or tenant identity is rendered.
"use client";

import { useCallback, useEffect, useState } from "react";
import type { RiderLiveTripProjection } from "@bookingapp/contracts";
import { fetchPublicLiveTrip, openPublicLiveStream, type PublicTransportEventSource, type TransportState } from "../../src/transport-public-client.js";

const request = (input: string, init?: { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string }) => window.fetch(input, init);
const freshnessLabels: Record<RiderLiveTripProjection["freshness"], string> = { live: "Live", delayed: "Delayed", signal_weak: "Weak signal", offline: "Offline" };

function dateText(value: string | null): string { if (!value) return "No location received yet"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

export function TransportLiveTripStatus({ token, apiBase }: { token: string; apiBase: string }) {
  const [state, setState] = useState<TransportState<RiderLiveTripProjection>>(() => apiBase ? { kind: "error", message: "Loading live trip location..." } : { kind: "unavailable", message: "Live trip location is not configured for this ticket." });
  const [streaming, setStreaming] = useState(false);
  const load = useCallback(async () => { if (!apiBase || !token) return; setState((current) => current.kind === "ready" ? current : { kind: "error", message: "Loading live trip location..." }); setState(await fetchPublicLiveTrip(request, apiBase, token)); }, [apiBase, token]);
  useEffect(() => {
    void load(); let streamActive = false; let closeStream = () => {};
    if (apiBase && token && typeof EventSource !== "undefined") { const factory = (url: string, init: { withCredentials: boolean }): PublicTransportEventSource => new EventSource(url, init) as unknown as PublicTransportEventSource; closeStream = openPublicLiveStream(factory, apiBase, token, (value) => { streamActive = true; setStreaming(true); setState({ kind: "ready", value }); }, () => { streamActive = true; setStreaming(true); void load(); }, () => { streamActive = false; setStreaming(false); }); }
    const interval = window.setInterval(() => { if (document.visibilityState === "visible" && !streamActive) void load(); }, 30_000);
    return () => { closeStream(); window.clearInterval(interval); };
  }, [apiBase, load, token]);
  const value = state.kind === "ready" ? state.value : null;
  return <section className="transport-live-trip" aria-labelledby="live-trip-title"><header><div><p className="public-eyebrow">LIVE TRIP</p><h2 id="live-trip-title">Vehicle location</h2></div>{value && <span className={`transport-live-badge transport-live-${value.freshness}`}>{freshnessLabels[value.freshness]}</span>}</header>{value && <div className="transport-live-details"><p>{value.latitude === null ? "Your operator has not shared a location yet." : "Your vehicle is sharing its latest location."}</p><dl><div><dt>Last update</dt><dd>{dateText(value.capturedAt)}</dd></div><div><dt>Connection</dt><dd>{streaming ? "Live updates" : "Checking periodically"}</dd></div></dl></div>}{state.kind !== "ready" && <p className="transport-live-message" role="status" aria-live="polite">{state.message}</p>}{state.kind !== "ready" && <button className="transport-secondary transport-live-retry" type="button" onClick={() => void load()}>Try again</button>}<small>Map view will appear when route geometry is ready. This status never guesses a vehicle position.</small></section>;
}
