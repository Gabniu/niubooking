// Ownership: NIU Driver application orchestration; native UI and OS adapters stay outside this package.

import { createDriverSessionClient, type DriverSessionFetcher } from "./session-client.js";
import { createDriverTelemetryFetcher, createDriverTrackingController, type DriverLocationSample, type DriverRecordResult, type DriverTelemetryFetcher, type DriverTelemetryQueue } from "./index.js";
import type { NativeAuthSession } from "./native-auth.js";

export type DriverMobilePhase = "signed_out" | "restoring" | "ready" | "starting" | "sharing" | "offline" | "stopping" | "error";

export interface DriverMobileSnapshot {
  readonly phase: DriverMobilePhase;
  readonly tripId: string | null;
  readonly expiresAt: string | null;
  readonly queuedPositions: number;
  readonly message: string | null;
}

export interface DriverMobileStartInput {
  readonly tenantId: string;
  readonly tripId: string;
  readonly deviceId: string;
  readonly durationMinutes?: number;
}

export interface DriverActiveSession {
  readonly tenantId: string;
  readonly tripId: string;
  readonly sessionId: string;
  readonly deviceId: string;
  readonly traccarCredential: string;
  readonly expiresAt: string;
}

export interface DriverCaptureLifecycle {
  start(session: DriverActiveSession): Promise<void>;
  stop(): Promise<void>;
}

export interface DriverActiveSessionStorage {
  read(): Promise<DriverActiveSession | null>;
  write(session: DriverActiveSession): Promise<void>;
  clear(): Promise<void>;
}

export interface DriverMobileDependencies {
  readonly auth: NativeAuthSession;
  readonly queue: DriverTelemetryQueue;
  readonly activeSessionStorage: DriverActiveSessionStorage;
  readonly sessionFetcher: DriverSessionFetcher;
  readonly telemetryFetcher: DriverTelemetryFetcher;
  readonly apiBaseUrl: string;
  readonly telemetryEndpoint: string;
  readonly capture?: DriverCaptureLifecycle;
  readonly now?: () => number;
}

export interface DriverMobileController {
  snapshot(): DriverMobileSnapshot;
  restore(): Promise<DriverMobileSnapshot>;
  start(input: DriverMobileStartInput): Promise<DriverMobileSnapshot>;
  stop(): Promise<DriverMobileSnapshot>;
  record(position: DriverLocationSample): Promise<DriverMobileSnapshot>;
  flush(): Promise<DriverMobileSnapshot>;
  signOut(): Promise<DriverMobileSnapshot>;
}

function messageForRecord(result: DriverRecordResult): string | null {
  if (result.kind === "blocked") return "Your tracking session needs attention. Sign in again or ask dispatch.";
  if (result.result === "retry") return "Connection lost. Positions are saved and will send when you reconnect.";
  if (result.result === "blocked") return "Your tracking session needs attention. Sign in again or ask dispatch.";
  return null;
}

export function createDriverMobileController(dependencies: DriverMobileDependencies): DriverMobileController {
  let phase: DriverMobilePhase = "signed_out";
  let tenantId: string | null = null;
  let tripId: string | null = null;
  let sessionId: string | null = null;
  let expiresAt: string | null = null;
  let telemetryCredential: string | null = null;
  let message: string | null = null;
  let queuedPositions = 0;
  const now = dependencies.now ?? Date.now;
  const tracking = createDriverTrackingController(dependencies.queue, async (position) => {
    if (!telemetryCredential) return "blocked";
    return createDriverTelemetryFetcher(dependencies.telemetryFetcher, dependencies.telemetryEndpoint, telemetryCredential)(position);
  });
  const refreshQueueCount = async (): Promise<void> => { queuedPositions = (await dependencies.queue.read()).length; };
  const snapshot = (): DriverMobileSnapshot => ({ phase, tripId, expiresAt, queuedPositions, message });

  return {
    snapshot,
    async restore() {
      phase = "restoring"; message = null;
      const restored = await dependencies.auth.restore();
      const active = restored.status === "signed_in" ? await dependencies.activeSessionStorage.read() : null;
      if (active && Date.parse(active.expiresAt) > now()) {
        tenantId = active.tenantId; tripId = active.tripId; sessionId = active.sessionId; expiresAt = active.expiresAt; telemetryCredential = active.traccarCredential;
        try { await dependencies.capture?.start(active); tracking.start(active.sessionId); phase = "sharing"; message = "Location sharing is on."; }
        catch { tracking.stop(); const token = dependencies.auth.getAccessToken(); const revoked = token ? await createDriverSessionClient(dependencies.sessionFetcher, dependencies.apiBaseUrl, token).end(active.tenantId, active.sessionId, "native provider restore failed") : null; if (revoked?.kind === "success") { await dependencies.activeSessionStorage.clear(); tenantId = null; tripId = null; sessionId = null; expiresAt = null; } phase = "error"; message = revoked?.kind === "success" ? "Location sharing could not resume safely. Start it again." : "Location sharing needs attention before it can be resumed or stopped."; }
      } else {
        if (active) await dependencies.activeSessionStorage.clear();
        telemetryCredential = null;
        phase = restored.status === "signed_in" ? "ready" : "signed_out";
      }
      await refreshQueueCount();
      return snapshot();
    },
    async start(input) {
      if (sessionId || phase === "starting" || phase === "stopping") { message = "Location sharing is already in progress."; return snapshot(); }
      const token = dependencies.auth.getAccessToken();
      if (!token) { phase = "signed_out"; message = "Sign in to use NIU Driver."; return snapshot(); }
      phase = "starting"; tenantId = input.tenantId; tripId = input.tripId; message = null;
      const client = createDriverSessionClient(dependencies.sessionFetcher, dependencies.apiBaseUrl, token);
      const result = await client.start(input.tenantId, input.tripId, input.deviceId, input.durationMinutes);
      if (result.kind !== "ready") { phase = "error"; message = result.message; return snapshot(); }
      const active: DriverActiveSession = { tenantId: input.tenantId, tripId: input.tripId, sessionId: result.sessionId, deviceId: input.deviceId, traccarCredential: result.traccarCredential, expiresAt: result.expiresAt };
      try { await dependencies.activeSessionStorage.write(active); } catch {
        await client.end(input.tenantId, result.sessionId, "local session storage failed");
        phase = "error"; message = "Tracking could not be saved. Try again."; return snapshot();
      }
      try { await dependencies.capture?.start(active); } catch {
        const revoked = await client.end(input.tenantId, result.sessionId, "native provider start failed");
        if (revoked.kind === "success") { await dependencies.activeSessionStorage.clear(); sessionId = null; expiresAt = null; telemetryCredential = null; }
        else { sessionId = result.sessionId; expiresAt = result.expiresAt; }
        phase = "error"; message = revoked.kind === "success" ? "Location sharing could not start safely. Try again." : "Location sharing needs attention before it can be stopped safely."; return snapshot();
      }
      telemetryCredential = result.traccarCredential;
      tracking.start(result.sessionId);
      sessionId = result.sessionId; expiresAt = result.expiresAt; phase = "sharing"; message = "Location sharing is on.";
      await refreshQueueCount();
      return snapshot();
    },
    async stop() {
      if (!sessionId || !tripId) { tracking.stop(); phase = "ready"; message = null; return snapshot(); }
      const token = dependencies.auth.getAccessToken();
      if (!token) { phase = "error"; message = "Sign in again before stopping location sharing."; return snapshot(); }
      phase = "stopping"; message = null;
      let captureFailed = false;
      try { await dependencies.capture?.stop(); } catch { captureFailed = true; }
      const result = await createDriverSessionClient(dependencies.sessionFetcher, dependencies.apiBaseUrl, token).end(tenantId ?? "", sessionId);
      if (result.kind !== "success") { phase = "error"; message = result.message; return snapshot(); }
      tracking.stop(); await dependencies.activeSessionStorage.clear(); sessionId = null; tenantId = null; tripId = null; expiresAt = null; telemetryCredential = null; phase = "ready"; message = captureFailed ? "Location sharing is off. The native provider needs attention." : "Location sharing is off.";
      await refreshQueueCount();
      return snapshot();
    },
    async record(position) {
      const result = await tracking.record({ eventId: position.eventId, capturedAt: position.capturedAt, latitude: position.latitude, longitude: position.longitude, accuracyMetres: position.accuracyMetres, ...(position.speedMetresPerSecond === undefined ? {} : { speedMetresPerSecond: position.speedMetresPerSecond }), ...(position.headingDegrees === undefined ? {} : { headingDegrees: position.headingDegrees }), ...(position.batteryPercent === undefined ? {} : { batteryPercent: position.batteryPercent }), ...(position.provider === undefined ? {} : { provider: position.provider }), ...(position.appVersion === undefined ? {} : { appVersion: position.appVersion }) });
      await refreshQueueCount();
      const nextMessage = messageForRecord(result);
      if (result.kind === "queued" && result.result === "retry") phase = "offline";
      else if (result.kind === "queued" && result.result === "accepted" && phase === "offline") phase = "sharing";
      else if (result.kind === "queued" && result.result === "blocked") phase = "error";
      message = nextMessage;
      return snapshot();
    },
    async flush() {
      const result = await tracking.flush();
      await refreshQueueCount();
      if (result === "accepted" && phase === "offline") { phase = "sharing"; message = "Connection restored. Location sharing is live."; }
      else if (result === "retry") { phase = "offline"; message = "Connection lost. Positions are saved and will send when you reconnect."; }
      else if (result === "blocked") { phase = "error"; message = "Your tracking session needs attention. Sign in again or ask dispatch."; }
      return snapshot();
    },
    async signOut() {
      if (sessionId) { phase = "error"; message = "Stop location sharing before signing out."; return snapshot(); }
      await dependencies.auth.clear(); await dependencies.activeSessionStorage.clear(); phase = "signed_out"; tenantId = null; tripId = null; expiresAt = null; telemetryCredential = null; message = null;
      return snapshot();
    },
  };
}
