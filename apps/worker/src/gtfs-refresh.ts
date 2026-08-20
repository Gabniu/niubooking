// Ownership: bounded GTFS-Realtime projection refresh and operational health.

import type { GtfsRealtimeRefreshHealth } from "./worker-health.js";

export interface GtfsRefreshTarget {
  publicSlug: string;
}

export interface GtfsRefreshTask {
  tick(now?: Date): Promise<GtfsRealtimeRefreshHealth>;
  health(now?: Date): GtfsRealtimeRefreshHealth;
}

export interface GtfsRefreshTaskOptions {
  listTargets(limit: number): Promise<readonly GtfsRefreshTarget[]>;
  refreshTarget(target: GtfsRefreshTarget, now: Date): Promise<{ entityCount: number } | null>;
  intervalMs?: number;
  maxTargets?: number;
}

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_MAX_TARGETS = 50;

function initialHealth(): GtfsRealtimeRefreshHealth {
  return { status: "not_ready", targetCount: 0, refreshedCount: 0, failedCount: 0, lastRunAt: null, reason: "GTFS realtime refresh has not run yet." };
}

export function createGtfsRefreshTask(options: GtfsRefreshTaskOptions): GtfsRefreshTask {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxTargets = options.maxTargets ?? DEFAULT_MAX_TARGETS;
  if (!Number.isInteger(intervalMs) || intervalMs < 15_000 || intervalMs > 300_000) throw new Error("GTFS refresh interval must be between 15000 and 300000 milliseconds");
  if (!Number.isInteger(maxTargets) || maxTargets < 1 || maxTargets > 100) throw new Error("GTFS refresh target limit must be between 1 and 100");
  let state = initialHealth();
  return {
    async tick(now = new Date()) {
      if (state.lastRunAt && now.getTime() - state.lastRunAt.getTime() < intervalMs) return state;
      let targets: readonly GtfsRefreshTarget[];
      try {
        targets = (await options.listTargets(maxTargets)).slice(0, maxTargets);
      } catch {
        state = { ...state, status: "degraded", lastRunAt: now, reason: "GTFS realtime feeds could not be listed." };
        return state;
      }
      let refreshedCount = 0;
      let failedCount = 0;
      for (const target of targets) {
        try {
          const result = await options.refreshTarget(target, now);
          if (result) refreshedCount += 1;
          else failedCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      const status = targets.length === 0 ? "healthy" : failedCount === 0 ? "healthy" : "degraded";
      state = {
        status,
        targetCount: targets.length,
        refreshedCount,
        failedCount,
        lastRunAt: now,
        reason: targets.length === 0 ? "No enabled public GTFS realtime feeds are configured." : failedCount ? `${failedCount} GTFS realtime feed refresh${failedCount === 1 ? "" : "es"} failed.` : null,
      };
      return state;
    },
    health(now = new Date()) {
      if (state.lastRunAt && now.getTime() - state.lastRunAt.getTime() > intervalMs * 3) return { ...state, status: "degraded", reason: "GTFS realtime refresh is overdue." };
      return state;
    },
  };
}
