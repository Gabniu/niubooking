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

export function workerHealth(configuredChannels: readonly string[], counters: WorkerCounters, now = new Date(), staleAfterMs = 5 * 60_000): WorkerHealth {
  if (configuredChannels.length === 0) return { status: "not_ready", configuredChannels: [], counters, reason: "No communication provider is configured." };
  if (counters.lastBatchAt && now.getTime() - counters.lastBatchAt.getTime() > staleAfterMs) return { status: "degraded", configuredChannels, counters, reason: "No worker batch has completed recently." };
  return { status: "ready", configuredChannels, counters, reason: null };
}
