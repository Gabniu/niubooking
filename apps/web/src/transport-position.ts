// Ownership: privacy-safe client interpolation; never predicts beyond trusted samples.

export interface TransportPositionSample {
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly capturedAt?: string | null;
}

export interface TransportPosition {
  readonly latitude: number;
  readonly longitude: number;
}

export function coordinatesFromSample(sample: TransportPositionSample | null | undefined): TransportPosition | null {
  if (!sample || sample.latitude === null || sample.longitude === null) return null;
  if (!Number.isFinite(sample.latitude) || !Number.isFinite(sample.longitude)) return null;
  return { latitude: sample.latitude, longitude: sample.longitude };
}

export function interpolateTransportPosition(from: TransportPosition, to: TransportPosition, progress: number): TransportPosition {
  const t = Math.min(1, Math.max(0, progress));
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * t,
    longitude: from.longitude + (to.longitude - from.longitude) * t,
  };
}

export function interpolationDurationMs(previousCapturedAt: string | null, nextCapturedAt: string | null): number {
  if (!previousCapturedAt || !nextCapturedAt) return 900;
  const previous = Date.parse(previousCapturedAt);
  const next = Date.parse(nextCapturedAt);
  if (!Number.isFinite(previous) || !Number.isFinite(next) || next <= previous) return 900;
  return Math.min(4_000, Math.max(450, next - previous));
}
