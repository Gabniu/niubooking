// Ownership: worker runtime composition. Scheduling cadence belongs to deployment; this module runs one safe tick.

import { resolveCommunicationRecipient, type SqlExecutor } from "@bookingapp/database";
import type { CommunicationJob } from "@bookingapp/domain";
import { runCommunicationBatch, type CommunicationProvider, type CommunicationWorkerOptions } from "./communication-worker.js";
import { createWorkerCounters, recordBatch, workerHealth, type GtfsRealtimeRefreshHealth, type WorkerCounters, type WorkerHealth } from "./worker-health.js";
import type { GtfsRefreshTask } from "./gtfs-refresh.js";

export interface WorkerRuntime {
  tick(now?: Date): Promise<WorkerHealth>;
  health(now?: Date): WorkerHealth;
}

export type WorkerRuntimeOptions = Pick<CommunicationWorkerOptions, "isSuppressed" | "resolveRecipient"> & { gtfsRealtimeRefresh?: GtfsRefreshTask };

export function createDatabaseRecipientResolver(executor: SqlExecutor): NonNullable<WorkerRuntimeOptions["resolveRecipient"]> {
  return (job: CommunicationJob) => resolveCommunicationRecipient(executor, job);
}

export function createWorkerRuntime(executor: SqlExecutor, provider: CommunicationProvider, configuredChannels: readonly string[], limit = 25, options: WorkerRuntimeOptions = {}): WorkerRuntime {
  const counters: WorkerCounters = createWorkerCounters();
  let gtfsRealtime: GtfsRealtimeRefreshHealth | undefined;
  const { gtfsRealtimeRefresh, ...communicationOptions } = options;
  return {
    async tick(now = new Date()) {
      const result = await runCommunicationBatch(executor, provider, { limit, now, ...communicationOptions });
      if (gtfsRealtimeRefresh) gtfsRealtime = await gtfsRealtimeRefresh.tick(now);
      return workerHealth(configuredChannels, recordBatch(counters, result, now), now, undefined, gtfsRealtime);
    },
    health(now = new Date()) { return workerHealth(configuredChannels, counters, now, undefined, gtfsRealtimeRefresh?.health(now) ?? gtfsRealtime); },
  };
}
