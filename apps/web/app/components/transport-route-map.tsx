// Ownership: privacy-safe route preview; it renders operator-supplied geometry without external map tiles.
"use client";

import type { PublicTransportRouteGeometry, PublicTransportStopSummary } from "@bookingapp/contracts";

type LivePosition = { latitude: number | null; longitude: number | null } | null;
type Point = readonly [longitude: number, latitude: number];

function pointsFromStops(stops: readonly PublicTransportStopSummary[]): Point[] { return stops.flatMap((stop) => stop.latitude !== undefined && stop.longitude !== undefined ? [[stop.longitude, stop.latitude] as const] : []); }
function project(point: Point, bounds: { minX: number; maxX: number; minY: number; maxY: number }): Point { const x = bounds.maxX === bounds.minX ? 50 : 8 + ((point[0] - bounds.minX) / (bounds.maxX - bounds.minX)) * 84; const y = bounds.maxY === bounds.minY ? 50 : 92 - ((point[1] - bounds.minY) / (bounds.maxY - bounds.minY)) * 84; return [x, y]; }
function boundsFor(points: readonly Point[]): { minX: number; maxX: number; minY: number; maxY: number } { const xs = points.map(([x]) => x); const ys = points.map(([, y]) => y); return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }; }

export function TransportRouteMap({ geometry, stops, livePosition, label = "Route map" }: { geometry?: PublicTransportRouteGeometry | null | undefined; stops: readonly PublicTransportStopSummary[]; livePosition?: LivePosition; label?: string }) {
  const stopPoints = pointsFromStops(stops);
  const routePoints = geometry?.coordinates?.length && geometry.coordinates.length >= 2 ? geometry.coordinates : stopPoints;
  if (routePoints.length < 2) return <div className="transport-route-map transport-route-map-unavailable" role="status"><strong>Route map unavailable</strong><span>Stop locations have not been published yet.</span></div>;
  const bounds = boundsFor(routePoints);
  const projectedRoute = routePoints.map((point) => project(point, bounds));
  const projectedStops = stops.flatMap((stop) => stop.latitude !== undefined && stop.longitude !== undefined ? [{ stop, point: project([stop.longitude, stop.latitude], bounds) }] : []);
  const projectedLive = livePosition && livePosition.latitude !== null && livePosition.longitude !== null ? project([livePosition.longitude, livePosition.latitude], bounds) : null;
  return <div className="transport-route-map"><svg viewBox="0 0 100 100" role="img" aria-label={label}><polyline className="transport-route-map-line" points={projectedRoute.map(([x, y]) => `${x},${y}`).join(" ")} />{projectedStops.map(({ stop, point }) => <circle className="transport-route-map-stop" key={stop.stopId} cx={point[0]} cy={point[1]} r="2.4"><title>{stop.label ?? stop.stopId}</title></circle>)}{projectedLive && <circle className="transport-route-map-vehicle" cx={projectedLive[0]} cy={projectedLive[1]} r="3.1"><title>Current vehicle position</title></circle>}</svg><ol className="transport-route-map-stops" aria-label="Route stops">{stops.map((stop) => <li key={stop.stopId}><span>{stop.sequence}</span><strong>{stop.label ?? stop.stopId}</strong></li>)}</ol></div>;
}
