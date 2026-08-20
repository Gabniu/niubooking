// Ownership: operational health and delivery counters. No secrets, message bodies, or client PII are exposed.

export interface WorkerCounters {
  claimed: number;
  sent: number;
  failed: number;
  suppressed: number;
  lastBatchAt: Date | null;
}

export interface WorkerHealth {
  status: "ready" | "degraded" | "not_ready";
  configuredChannels: readonly string[];
  counters: WorkerCounters;
  gtfsRealtime?: GtfsRealtimeRefreshHealth;
  reason: string | null;
}

export interface GtfsRealtimeRefreshHealth {
  status: "healthy" | "degraded" | "not_ready";
  targetCount: number;
  refreshedCount: number;
  failedCount: number;
  lastRunAt: Date | null;
  reason: string | null;
}

export function createWorkerCounters(): WorkerCounters {
  return { claimed: 0, sent: 0, failed: 0, suppressed: 0, lastBatchAt: null };
}

export function recordBatch(counters: WorkerCounters, result: { claimed: number; sent: number; failed: number; suppressed: number }, at = new Date()): WorkerCounters {
  counters.claimed += result.claimed;
  counters.sent += result.sent;
  counters.failed += result.failed;
  counters.suppressed += result.suppressed;
  counters.lastBatchAt = at;
  return counters;
}

export function workerHealth(configuredChannels: readonly string[], counters: WorkerCounters, now = new Date(), staleAfterMs = 5 * 60_000, gtfsRealtime?: GtfsRealtimeRefreshHealth): WorkerHealth {
  const reason = configuredChannels.length === 0 ? "No communication provider is configured." : counters.lastBatchAt && now.getTime() - counters.lastBatchAt.getTime() > staleAfterMs ? "No worker batch has completed recently." : gtfsRealtime?.reason ?? null;
  const status = configuredChannels.length === 0 ? "not_ready" : counters.lastBatchAt && now.getTime() - counters.lastBatchAt.getTime() > staleAfterMs || gtfsRealtime?.status === "degraded" || gtfsRealtime?.status === "not_ready" ? "degraded" : "ready";
  return { status, configuredChannels: configuredChannels.length ? configuredChannels : [], counters, ...(gtfsRealtime ? { gtfsRealtime } : {}), reason };
}
