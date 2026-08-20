// Ownership: optional tile-backed rider map; fallback remains the privacy-safe route diagram.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapInstance, Marker } from "maplibre-gl";
import type { PublicTransportRouteGeometry, PublicTransportStopSummary } from "@bookingapp/contracts";
import { useTransportSmoothPosition } from "./transport-smooth-position.js";
import { TransportRouteMap } from "./transport-route-map.js";

type LivePosition = { latitude: number | null; longitude: number | null; capturedAt?: string | null } | null;
type Point = readonly [longitude: number, latitude: number];

function validStyleUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch { return false; }
}

function routePoints(geometry: PublicTransportRouteGeometry | null | undefined, stops: readonly PublicTransportStopSummary[]): Point[] {
  if (geometry?.coordinates && geometry.coordinates.length >= 2) return [...geometry.coordinates];
  return stops.flatMap((stop) => stop.latitude !== undefined && stop.longitude !== undefined ? [[stop.longitude, stop.latitude] as const] : []);
}

function bounds(points: readonly Point[]): [[number, number], [number, number]] {
  const xs = points.map(([x]) => x); const ys = points.map(([, y]) => y);
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
}

function stopFeatures(stops: readonly PublicTransportStopSummary[]) {
  return stops.flatMap((stop) => stop.latitude !== undefined && stop.longitude !== undefined ? [{ type: "Feature" as const, properties: { label: stop.label ?? stop.stopId, sequence: stop.sequence }, geometry: { type: "Point" as const, coordinates: [stop.longitude, stop.latitude] } }] : []);
}

function StopList({ stops }: { stops: readonly PublicTransportStopSummary[] }) {
  return <ol className="transport-interactive-stops" aria-label="Route stops">{stops.map((stop) => <li key={stop.stopId}><span>{stop.sequence}</span><strong>{stop.label ?? stop.stopId}</strong></li>)}</ol>;
}

export function TransportInteractiveMap({ geometry, stops, livePosition, styleUrl, label = "Interactive vehicle route", smoothLivePosition = false }: { geometry?: PublicTransportRouteGeometry | null | undefined; stops: readonly PublicTransportStopSummary[]; livePosition?: LivePosition; styleUrl?: string | null; label?: string; smoothLivePosition?: boolean }) {
  const points = useMemo(() => routePoints(geometry, stops), [geometry, stops]);
  const smoothed = useTransportSmoothPosition(livePosition ?? null, smoothLivePosition);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const routeKey = JSON.stringify(points);

  useEffect(() => {
    if (!validStyleUrl(styleUrl) || points.length < 2) return;
    let active = true;
    const container = document.createElement("div");
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren(container);
    const start = async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (!active) return;
        maplibreRef.current = maplibre;
        const map = new maplibre.Map({ container, style: styleUrl, attributionControl: { compact: true }, cooperativeGestures: true });
        mapRef.current = map;
        map.on("load", () => {
          if (!active) return;
          map.addSource("transport-route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points } } });
          map.addLayer({ id: "transport-route-line", type: "line", source: "transport-route", paint: { "line-color": "#140BA7", "line-width": 4, "line-opacity": 0.9 } });
          map.addSource("transport-stops", { type: "geojson", data: { type: "FeatureCollection", features: stopFeatures(stops) } });
          map.addLayer({ id: "transport-stop-circles", type: "circle", source: "transport-stops", paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": "#140BA7", "circle-stroke-width": 2 } });
          map.fitBounds(bounds(points), { padding: 36, duration: 0 });
          setMapReady(true);
        });
        map.on("error", () => { if (active) setMapError(true); });
      } catch { if (active) setMapError(true); }
    };
    void start();
    return () => { active = false; markerRef.current?.remove(); markerRef.current = null; mapRef.current?.remove(); mapRef.current = null; setMapReady(false); };
  }, [routeKey, styleUrl, stops, points]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !maplibreRef.current || !smoothed) { markerRef.current?.remove(); markerRef.current = null; return; }
    if (!markerRef.current) {
      const element = document.createElement("div");
      element.className = "transport-map-vehicle-marker";
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", "Current vehicle position");
      markerRef.current = new maplibreRef.current.Marker({ element }).addTo(mapRef.current);
    }
    markerRef.current.setLngLat([smoothed.longitude, smoothed.latitude]);
  }, [mapReady, smoothed?.latitude, smoothed?.longitude]);

  if (!validStyleUrl(styleUrl) || points.length < 2 || mapError) return <div className="transport-interactive-map-fallback"><p className="transport-map-note">{mapError ? "The interactive map is unavailable right now." : "A route diagram is shown until an approved map style is configured."}</p><TransportRouteMap geometry={geometry} stops={stops} livePosition={livePosition ?? null} smoothLivePosition={smoothLivePosition} label={label} /></div>;
  return <div className="transport-interactive-map"><div className="transport-map-canvas" ref={hostRef} data-transport-interactive-map role="img" aria-label={label} />{!mapReady && <p className="transport-map-note" role="status">Loading the interactive map…</p>}<StopList stops={stops} /></div>;
}
