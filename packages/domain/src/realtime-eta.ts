// Ownership: conservative, route-aware ETA estimates from trusted telemetry.

import type { PositionFreshness } from "./realtime-telemetry.js";

export type EtaConfidence = "low" | "medium" | "high";
export type EtaCoordinate = readonly [longitude: number, latitude: number];

export interface RouteEtaStop {
  readonly sequence: number;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly boardingMinutes: number;
  readonly alightingMinutes: number;
}

export interface RouteEtaEstimate {
  readonly earliestArrival: Date;
  readonly latestArrival: Date;
  readonly confidence: EtaConfidence;
  readonly distanceMetres: number;
}

export interface RouteEtaInput {
  readonly geometry: { readonly type: "LineString"; readonly coordinates: readonly EtaCoordinate[] } | null | undefined;
  readonly stops: readonly RouteEtaStop[];
  readonly destinationStopSequence: number;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accuracyMetres: number | null;
  readonly speedMetresPerSecond?: number | null;
  readonly capturedAt: Date | null;
  readonly freshness: PositionFreshness;
  readonly now: Date;
}

export interface RouteEtaPolicy {
  readonly fallbackSpeedMetresPerSecond: number;
  readonly minimumSpeedMetresPerSecond: number;
  readonly maximumSpeedMetresPerSecond: number;
  readonly maximumRouteOffsetMetres: number;
  readonly maximumHorizonSeconds: number;
}

export const defaultRouteEtaPolicy: RouteEtaPolicy = {
  fallbackSpeedMetresPerSecond: 8,
  minimumSpeedMetresPerSecond: 3,
  maximumSpeedMetresPerSecond: 25,
  maximumRouteOffsetMetres: 3_000,
  maximumHorizonSeconds: 4 * 60 * 60,
};

const EARTH_RADIUS_METRES = 6_371_000;

function finite(value: number | null | undefined): value is number { return value !== null && value !== undefined && Number.isFinite(value); }
function radians(value: number): number { return value * Math.PI / 180; }
function validCoordinate(point: EtaCoordinate): boolean { return finite(point[0]) && finite(point[1]) && point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90; }
function distanceMetres(left: EtaCoordinate, right: EtaCoordinate): number {
  const latitudeDelta = radians(right[1] - left[1]);
  const longitudeDelta = radians(right[0] - left[0]);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(left[1])) * Math.cos(radians(right[1])) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(a)));
}

function nearestRoutePoint(point: EtaCoordinate, geometry: readonly EtaCoordinate[]): { alongMetres: number; offsetMetres: number } | null {
  if (geometry.length < 2 || geometry.some((coordinate) => !validCoordinate(coordinate)) || !validCoordinate(point)) return null;
  let cumulative = 0; let best: { alongMetres: number; offsetMetres: number } | null = null;
  for (let index = 1; index < geometry.length; index += 1) {
    const start = geometry[index - 1]!; const end = geometry[index]!; const meanLatitude = radians((start[1] + end[1]) / 2);
    const scaleX = EARTH_RADIUS_METRES * Math.cos(meanLatitude) * Math.PI / 180; const scaleY = EARTH_RADIUS_METRES * Math.PI / 180;
    const ax = start[0] * scaleX; const ay = start[1] * scaleY; const bx = end[0] * scaleX; const by = end[1] * scaleY; const px = point[0] * scaleX; const py = point[1] * scaleY;
    const dx = bx - ax; const dy = by - ay; const lengthSquared = dx * dx + dy * dy; const length = Math.sqrt(lengthSquared);
    if (length === 0) continue;
    const progress = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
    const offset = Math.hypot(px - (ax + dx * progress), py - (ay + dy * progress));
    const candidate = { alongMetres: cumulative + length * progress, offsetMetres: offset };
    if (!best || candidate.offsetMetres < best.offsetMetres) best = candidate;
    cumulative += length;
  }
  return best;
}

function confidence(input: RouteEtaInput): EtaConfidence {
  const hasSpeed = finite(input.speedMetresPerSecond) && input.speedMetresPerSecond > 0;
  if (input.freshness === "live" && hasSpeed && finite(input.accuracyMetres) && input.accuracyMetres <= 30) return "high";
  if ((input.freshness === "live" || input.freshness === "delayed") && finite(input.accuracyMetres) && input.accuracyMetres <= 100) return "medium";
  return "low";
}

export function estimateRouteEta(input: RouteEtaInput, policy: RouteEtaPolicy = defaultRouteEtaPolicy): RouteEtaEstimate | null {
  if (input.freshness === "offline" || !input.geometry || input.geometry.type !== "LineString" || !input.capturedAt || !Number.isFinite(input.capturedAt.getTime()) || !Number.isFinite(input.now.getTime()) || input.latitude === null || input.longitude === null) return null;
  const ageSeconds = Math.max(0, (input.now.getTime() - input.capturedAt.getTime()) / 1_000);
  if (ageSeconds > 120 || !finite(input.latitude) || !finite(input.longitude)) return null;
  const destination = input.stops.find((stop) => stop.sequence === input.destinationStopSequence);
  if (!destination || !finite(destination.latitude) || !finite(destination.longitude)) return null;
  const currentOnRoute = nearestRoutePoint([input.longitude, input.latitude], input.geometry.coordinates);
  const destinationOnRoute = nearestRoutePoint([destination.longitude, destination.latitude], input.geometry.coordinates);
  if (!currentOnRoute || !destinationOnRoute || currentOnRoute.offsetMetres > policy.maximumRouteOffsetMetres || destinationOnRoute.offsetMetres > policy.maximumRouteOffsetMetres) return null;
  const distance = destinationOnRoute.alongMetres - currentOnRoute.alongMetres;
  if (distance < 100 || distance > policy.maximumHorizonSeconds * policy.maximumSpeedMetresPerSecond) return null;
  const dwellMinutes = input.stops.filter((stop) => finite(stop.latitude) && finite(stop.longitude) && stop.sequence > 0).reduce((total, stop) => {
    const stopOnRoute = nearestRoutePoint([stop.longitude!, stop.latitude!], input.geometry!.coordinates);
    return stopOnRoute && stopOnRoute.alongMetres > currentOnRoute.alongMetres && stopOnRoute.alongMetres <= destinationOnRoute.alongMetres + 25 ? total + stop.boardingMinutes + stop.alightingMinutes : total;
  }, 0);
  const observedSpeed = finite(input.speedMetresPerSecond) && input.speedMetresPerSecond > 0 ? input.speedMetresPerSecond : policy.fallbackSpeedMetresPerSecond;
  const baseSpeed = Math.min(policy.maximumSpeedMetresPerSecond, Math.max(policy.minimumSpeedMetresPerSecond, observedSpeed));
  const fastSpeed = Math.min(policy.maximumSpeedMetresPerSecond, baseSpeed * 1.2);
  const slowSpeed = Math.max(policy.minimumSpeedMetresPerSecond, baseSpeed * 0.65);
  const uncertaintySeconds = Math.min(900, Math.max(60, (input.accuracyMetres ?? 100) * 2 + ageSeconds));
  const earliestSeconds = distance / fastSpeed + dwellMinutes * 60;
  const latestSeconds = distance / slowSpeed + dwellMinutes * 90 + uncertaintySeconds;
  if (latestSeconds > policy.maximumHorizonSeconds) return null;
  return { earliestArrival: new Date(input.now.getTime() + earliestSeconds * 1_000), latestArrival: new Date(input.now.getTime() + latestSeconds * 1_000), confidence: confidence(input), distanceMetres: distance };
}
