// Ownership: OsmAnd-compatible provider parsing. It converts only transport fields; session scope stays server-owned.

import { createHash } from "node:crypto";
import type { FleetTelemetryObservation } from "@bookingapp/domain";

export interface OsmAndObservationInput {
  readonly credential: string;
  readonly observation: FleetTelemetryObservation;
}

export type OsmAndParseResult =
  | { readonly kind: "ready"; readonly value: OsmAndObservationInput }
  | { readonly kind: "invalid"; readonly message: string };

const KNOTS_TO_METRES_PER_SECOND = 0.514444;

function text(source: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function number(source: Record<string, unknown>, ...keys: string[]): number | null {
  const value = text(source, ...keys);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestamp(source: Record<string, unknown>): Date | null {
  const raw = text(source, "timestamp");
  if (!raw) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return new Date(numeric < 2_147_483_647 ? numeric * 1_000 : numeric);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function coordinates(source: Record<string, unknown>): { latitude: number; longitude: number } | null {
  const latitude = number(source, "lat");
  const longitude = number(source, "lon");
  if (latitude !== null && longitude !== null) return { latitude, longitude };
  const location = text(source, "location")?.split(",").map(Number);
  return location?.length === 2 && location.every(Number.isFinite) && location[0] !== undefined && location[1] !== undefined ? { latitude: location[0], longitude: location[1] } : null;
}

function eventId(credential: string, observation: Omit<FleetTelemetryObservation, "eventId">): string {
  const canonical = JSON.stringify({ credential, capturedAt: observation.capturedAt.toISOString(), latitude: observation.latitude, longitude: observation.longitude, accuracyMetres: observation.accuracyMetres, speedMetresPerSecond: observation.speedMetresPerSecond ?? null, headingDegrees: observation.headingDegrees ?? null, batteryPercent: observation.batteryPercent ?? null });
  return `osmand-${createHash("sha256").update(canonical).digest("hex")}`;
}

export function parseOsmAndObservation(source: Record<string, unknown>): OsmAndParseResult {
  const credential = text(source, "id", "deviceid");
  const capturedAt = timestamp(source);
  const position = coordinates(source);
  const valid = text(source, "valid");
  if (!credential || credential.length > 1024 || !capturedAt || !position || valid === "false" || valid === "0") {
    return { kind: "invalid", message: "A valid device credential, timestamp, and location are required." };
  }

  const accuracy = number(source, "accuracy") ?? 0;
  const speedKnots = number(source, "speed");
  const heading = number(source, "bearing", "course");
  const battery = number(source, "batt", "battery");
  const observation = {
    capturedAt,
    ...position,
    accuracyMetres: accuracy,
    ...(speedKnots === null ? {} : { speedMetresPerSecond: speedKnots * KNOTS_TO_METRES_PER_SECOND }),
    ...(heading === null ? {} : { headingDegrees: heading }),
    ...(battery === null ? {} : { batteryPercent: battery }),
  };
  return { kind: "ready", value: { credential, observation: { ...observation, eventId: eventId(credential, observation) } } };
}
