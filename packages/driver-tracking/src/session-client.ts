// Ownership: authenticated driver session commands; the mobile app supplies its platform auth transport.

export interface DriverSessionFetcher {
  (url: string, init: { credentials: "include"; method: "POST"; headers: { "content-type": "application/json" }; body: string }): Promise<{ status: number; json(): Promise<unknown> }>;
}

export type DriverSessionStartState =
  | { kind: "ready"; sessionId: string; expiresAt: string }
  | { kind: "denied" | "error"; message: string };
export type DriverSessionEndState =
  | { kind: "success"; endedAt: string }
  | { kind: "denied" | "error"; message: string };

function safeMessage(status: number, fallback: string): { kind: "denied" | "error"; message: string } {
  return status === 401 || status === 403 ? { kind: "denied", message: "You cannot control this assigned trip." } : { kind: "error", message: fallback };
}

export function createDriverSessionClient(fetcher: DriverSessionFetcher, baseUrl: string) {
  return {
    async start(tenantId: string, tripId: string, deviceId: string, durationMinutes = 480): Promise<DriverSessionStartState> {
      const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/fleet/tracking-sessions`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tripId, deviceId, durationMinutes }) });
      const body = (await response.json()) as { data?: { id?: string; expiresAt?: string } | null };
      if (body.data?.id && body.data.expiresAt) return { kind: "ready", sessionId: body.data.id, expiresAt: body.data.expiresAt };
      return safeMessage(response.status, "Tracking could not start. Check the assigned trip and device.");
    },
    async end(tenantId: string, sessionId: string, reason = "stopped from NIU Driver"): Promise<DriverSessionEndState> {
      const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/fleet/tracking-sessions/${encodeURIComponent(sessionId)}/end`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
      const body = (await response.json()) as { data?: { endedAt?: string | null } | null };
      if (body.data?.endedAt) return { kind: "success", endedAt: body.data.endedAt };
      return safeMessage(response.status, "Tracking could not stop. Try again or contact dispatch.");
    },
  };
}
