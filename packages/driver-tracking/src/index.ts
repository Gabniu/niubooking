// Ownership: platform-neutral NIU Driver telemetry core; native location and secure storage stay at the app edge.

import type { DriverPositionUpload } from "@bookingapp/contracts";
export { createDriverSessionClient, type DriverSessionEndState, type DriverSessionFetcher, type DriverSessionStartState } from "./session-client.js";

export interface DriverLocationSample {
  readonly eventId: string;
  readonly capturedAt: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMetres: number;
  readonly speedMetresPerSecond?: number;
  readonly headingDegrees?: number;
  readonly batteryPercent?: number;
  readonly provider?: string;
  readonly appVersion?: string;
}

export interface DriverTelemetryQueue {
  read(): Promise<readonly DriverPositionUpload[]>;
  append(position: DriverPositionUpload): Promise<void>;
  removeFirst(): Promise<void>;
}

export interface DriverTelemetryFetcher {
  (url: string, init: { method: "POST"; headers: { authorization: string; "content-type": "application/json" }; body: string }): Promise<{ status: number }>;
}

export type DriverSendResult = "accepted" | "retry" | "blocked" | "dropped";
export type DriverRecordResult = { kind: "queued"; sequence: number; result: DriverSendResult } | { kind: "blocked"; reason: "session_inactive" };

export interface DriverTrackingController {
  start(sessionId: string, initialSequence?: number): void;
  stop(): void;
  snapshot(): { readonly sessionId: string | null; readonly nextSequence: number; readonly active: boolean };
  record(sample: DriverLocationSample): Promise<DriverRecordResult>;
  flush(): Promise<DriverSendResult>;
}

export function createMemoryTelemetryQueue(): DriverTelemetryQueue {
  const values: DriverPositionUpload[] = [];
  return {
    async read() { return values.slice(); },
    async append(position) { values.push(position); },
    async removeFirst() { values.shift(); },
  };
}

export function createDriverTelemetryFetcher(fetcher: DriverTelemetryFetcher, endpoint: string, credential: string) {
  return async (position: DriverPositionUpload): Promise<DriverSendResult> => {
    try {
      const response = await fetcher(endpoint, { method: "POST", headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" }, body: JSON.stringify(position) });
      if (response.status === 202) return "accepted";
      if (response.status === 401 || response.status === 409) return "blocked";
      if (response.status >= 500) return "retry";
      return "dropped";
    } catch { return "retry"; }
  };
}

export function createDriverTrackingController(queue: DriverTelemetryQueue, send: (position: DriverPositionUpload) => Promise<DriverSendResult>): DriverTrackingController {
  let sessionId: string | null = null;
  let nextSequence = 0;
  const snapshot = () => ({ sessionId, nextSequence, active: sessionId !== null });
  return {
    start(nextSessionId, initialSequence = 0) { sessionId = nextSessionId; nextSequence = Math.max(0, Math.floor(initialSequence)); },
    stop() { sessionId = null; },
    snapshot,
    async record(sample) {
      if (!sessionId) return { kind: "blocked", reason: "session_inactive" };
      const position: DriverPositionUpload = { sessionId, eventId: sample.eventId, sequence: nextSequence, capturedAt: sample.capturedAt, latitude: sample.latitude, longitude: sample.longitude, accuracyMetres: sample.accuracyMetres, ...(sample.speedMetresPerSecond === undefined ? {} : { speedMetresPerSecond: sample.speedMetresPerSecond }), ...(sample.headingDegrees === undefined ? {} : { headingDegrees: sample.headingDegrees }), ...(sample.batteryPercent === undefined ? {} : { batteryPercent: sample.batteryPercent }), ...(sample.provider === undefined ? {} : { provider: sample.provider }), ...(sample.appVersion === undefined ? {} : { appVersion: sample.appVersion }) };
      nextSequence += 1;
      await queue.append(position);
      const result = await this.flush();
      return { kind: "queued", sequence: position.sequence, result };
    },
    async flush() {
      let result: DriverSendResult = "accepted";
      while (true) {
        const pending = await queue.read();
        if (!pending[0]) return result;
        result = await send(pending[0]);
        if (result === "retry" || result === "blocked") return result;
        await queue.removeFirst();
      }
    },
  };
}
