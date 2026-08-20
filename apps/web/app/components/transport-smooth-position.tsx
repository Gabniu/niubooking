// Ownership: visual smoothing between trusted live samples; never extrapolates.
"use client";

import { useEffect, useRef, useState } from "react";
import { coordinatesFromSample, interpolationDurationMs, interpolateTransportPosition, type TransportPosition, type TransportPositionSample } from "../../src/transport-position.js";

export function useTransportSmoothPosition(sample: TransportPositionSample | null | undefined, enabled = true): TransportPosition | null {
  const next = coordinatesFromSample(sample);
  const [displayed, setDisplayed] = useState<TransportPosition | null>(next);
  const displayedRef = useRef<TransportPosition | null>(next);
  const previousRef = useRef<{ coordinates: TransportPosition; capturedAt: string | null } | null>(next ? { coordinates: next, capturedAt: sample?.capturedAt ?? null } : null);

  useEffect(() => {
    if (!next) {
      previousRef.current = null;
      displayedRef.current = null;
      setDisplayed(null);
      return;
    }
    const previous = previousRef.current;
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!enabled || reduced || !previous || previous.capturedAt === (sample?.capturedAt ?? null)) {
      previousRef.current = { coordinates: next, capturedAt: sample?.capturedAt ?? null };
      displayedRef.current = next;
      setDisplayed(next);
      return;
    }
    const from = displayedRef.current ?? previous.coordinates;
    const startedAt = performance.now();
    const duration = interpolationDurationMs(previous.capturedAt, sample?.capturedAt ?? null);
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const position = interpolateTransportPosition(from, next, progress);
      displayedRef.current = position;
      setDisplayed(position);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    previousRef.current = { coordinates: next, capturedAt: sample?.capturedAt ?? null };
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, next?.latitude, next?.longitude, sample?.capturedAt]);

  return displayed;
}
