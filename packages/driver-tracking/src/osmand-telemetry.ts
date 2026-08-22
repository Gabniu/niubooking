// Ownership: driver-tracking provider boundary. Translate shared uploads into server-owned OsmAnd fields.

import type { DriverTelemetryFetcher } from './index.js';

interface PositionPayload {
  readonly capturedAt: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMetres: number;
  readonly speedMetresPerSecond?: number;
  readonly headingDegrees?: number;
  readonly batteryPercent?: number;
}

export interface NativeProviderTransport {
  (url: string, init: { method: 'POST'; headers: { 'content-type': 'application/x-www-form-urlencoded' }; body: string }): Promise<{ status: number }>;
}

function payload(value: unknown): PositionPayload | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (typeof source.capturedAt !== 'string' || typeof source.latitude !== 'number' || typeof source.longitude !== 'number' || typeof source.accuracyMetres !== 'number' || !Number.isFinite(source.latitude) || !Number.isFinite(source.longitude) || !Number.isFinite(source.accuracyMetres)) return null;
  return {
    capturedAt: source.capturedAt,
    latitude: source.latitude,
    longitude: source.longitude,
    accuracyMetres: source.accuracyMetres,
    ...(typeof source.speedMetresPerSecond === 'number' ? { speedMetresPerSecond: source.speedMetresPerSecond } : {}),
    ...(typeof source.headingDegrees === 'number' ? { headingDegrees: source.headingDegrees } : {}),
    ...(typeof source.batteryPercent === 'number' ? { batteryPercent: source.batteryPercent } : {}),
  };
}

function credential(authorization: string): string | null {
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() || null : null;
}

export function createNativeOsmAndTelemetryFetcher(transport: NativeProviderTransport): DriverTelemetryFetcher {
  return async (url, init) => {
    let source: unknown;
    try { source = JSON.parse(init.body) as unknown; } catch { return { status: 400 }; }
    const position = payload(source);
    const providerCredential = credential(init.headers.authorization);
    if (!position || !providerCredential) return { status: 400 };
    const form = new URLSearchParams({
      id: providerCredential,
      timestamp: position.capturedAt,
      lat: String(position.latitude),
      lon: String(position.longitude),
      accuracy: String(position.accuracyMetres),
      valid: '1',
      ...(position.speedMetresPerSecond === undefined ? {} : { speed: String(position.speedMetresPerSecond / 0.514444) }),
      ...(position.headingDegrees === undefined ? {} : { bearing: String(position.headingDegrees) }),
      ...(position.batteryPercent === undefined ? {} : { batt: String(position.batteryPercent) }),
    });
    return transport(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() });
  };
}
