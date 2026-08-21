// Ownership: worker process entrypoint. It composes providers once, then runs bounded outbox ticks.

import { createPool, createPoolExecutor, readPublicGtfsTripUpdates, readPublicGtfsVehiclePositions, withPublicTransaction, writeCachedGtfsTripUpdates, writeCachedGtfsVehiclePositions } from "@bookingapp/database";
import { createHash } from "node:crypto";
import { serializeGtfsRealtimeTripUpdates, serializeGtfsRealtimeVehiclePositions } from "@bookingapp/domain";
import { createHttpChannelProvider } from "./http-channel-provider.js";
import { createWorkerHealthServer } from "./health-server.js";
import { createProviderRouter, type ChannelProviders } from "./provider-router.js";
import { readWorkerRuntimeConfig } from "./runtime-config.js";
import { createDatabaseRecipientResolver, createWorkerRuntime } from "./worker-runtime.js";
import { createGtfsRefreshTask } from "./gtfs-refresh.js";

const config = readWorkerRuntimeConfig(process.env);
const pool = createPool(config.databaseUrl);
const executor = createPoolExecutor(pool);
const providers: ChannelProviders = {};
const request = async (url: string, init: { method: "POST"; headers: Record<string, string>; body: string; signal: AbortSignal }) => {
  const response = await fetch(url, init);
  return { ok: response.ok, status: response.status, text: () => response.text() };
};
for (const provider of config.providers) providers[provider.channel] = createHttpChannelProvider(provider, request);
const router = createProviderRouter(providers, { feedback: { executor, publicBaseUrl: config.publicBaseUrl } });
const gtfsRealtimeRefresh = createGtfsRefreshTask({
  intervalMs: config.gtfsRefreshIntervalMs,
  maxTargets: config.gtfsRefreshLimit,
  listTargets: async (limit) => withPublicTransaction(pool, async (publicExecutor) => (await publicExecutor.query<{ public_slug: string }>("SELECT public_slug FROM gtfs_feed_settings WHERE schedule_publication_enabled = true AND realtime_publication_enabled = true ORDER BY public_slug LIMIT $1", [limit])).map((row) => ({ publicSlug: row.public_slug }))),
  refreshTarget: async (target, now) => {
    const vehicleFeed = await readPublicGtfsVehiclePositions(pool, target.publicSlug, now);
    const tripFeed = await readPublicGtfsTripUpdates(pool, target.publicSlug, now);
    let entityCount = 0; let written = false;
    if (vehicleFeed) { const payload = serializeGtfsRealtimeVehiclePositions(vehicleFeed); const lastObservationAt = vehicleFeed.entities.reduce<Date | null>((latest, entity) => !latest || entity.capturedAt > latest ? entity.capturedAt : latest, null); written = await writeCachedGtfsVehiclePositions(pool, { publicSlug: target.publicSlug, scheduleVersion: vehicleFeed.scheduleVersion, payload, sha256: createHash("sha256").update(payload).digest("hex"), generatedAt: vehicleFeed.generatedAt, lastObservationAt, entityCount: vehicleFeed.entities.length }) || written; entityCount += vehicleFeed.entities.length; }
    if (tripFeed) { const payload = serializeGtfsRealtimeTripUpdates(tripFeed); written = await writeCachedGtfsTripUpdates(pool, { publicSlug: target.publicSlug, scheduleVersion: tripFeed.scheduleVersion, payload, sha256: createHash("sha256").update(payload).digest("hex"), generatedAt: tripFeed.generatedAt, entityCount: tripFeed.entities.length }) || written; entityCount += tripFeed.entities.length; }
    return written ? { entityCount } : null;
  },
});
const runtime = createWorkerRuntime(executor, router, config.providers.map((provider) => provider.channel), config.batchLimit, { resolveRecipient: createDatabaseRecipientResolver(executor), gtfsRealtimeRefresh });
const health = createWorkerHealthServer(runtime);
const timer = setInterval(() => { void runtime.tick().catch(() => undefined); }, config.intervalMs);
timer.unref();

await new Promise<void>((resolve, reject) => health.listen(config.healthPort, config.healthHost, () => resolve()).on("error", reject));
void runtime.tick().catch(() => undefined);
console.log(`Booking worker health listening on ${config.healthHost}:${config.healthPort}`);

async function shutdown(): Promise<void> {
  clearInterval(timer);
  await new Promise<void>((resolve) => health.close(() => resolve()));
  await pool.end();
}
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { void shutdown(); });
