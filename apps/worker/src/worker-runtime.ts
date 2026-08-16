// Ownership: worker runtime composition. Scheduling cadence belongs to deployment; this module runs one safe tick.

import { resolveCommunicationRecipient, type SqlExecutor } from "@bookingapp/database";
import type { CommunicationJob } from "@bookingapp/domain";
import { runCommunicationBatch, type CommunicationProvider, type CommunicationWorkerOptions } from "./communication-worker.js";
import { createWorkerCounters, recordBatch, workerHealth, type WorkerCounters, type WorkerHealth } from "./worker-health.js";

export interface WorkerRuntime {
  tick(now?: Date): Promise<WorkerHealth>;
  health(now?: Date): WorkerHealth;
}

export type WorkerRuntimeOptions = Pick<CommunicationWorkerOptions, "isSuppressed" | "resolveRecipient">;

export function createDatabaseRecipientResolver(executor: SqlExecutor): NonNullable<WorkerRuntimeOptions["resolveRecipient"]> {
  return (job: CommunicationJob) => resolveCommunicationRecipient(executor, job);
}

export function createWorkerRuntime(executor: SqlExecutor, provider: CommunicationProvider, configuredChannels: readonly string[], limit = 25, options: WorkerRuntimeOptions = {}): WorkerRuntime {
  const counters: WorkerCounters = createWorkerCounters();
  return {
    async tick(now = new Date()) {
      const result = await runCommunicationBatch(executor, provider, { limit, now, ...options });
      return workerHealth(configuredChannels, recordBatch(counters, result, now), now);
    },
    health(now = new Date()) { return workerHealth(configuredChannels, counters, now); },
  };
}
