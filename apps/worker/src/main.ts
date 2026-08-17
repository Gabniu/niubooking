// Ownership: worker process entrypoint. It composes providers once, then runs bounded outbox ticks.

import { createPool, createPoolExecutor } from "@bookingapp/database";
import { createHttpChannelProvider } from "./http-channel-provider.js";
import { createWorkerHealthServer } from "./health-server.js";
import { createProviderRouter, type ChannelProviders } from "./provider-router.js";
import { readWorkerRuntimeConfig } from "./runtime-config.js";
import { createDatabaseRecipientResolver, createWorkerRuntime } from "./worker-runtime.js";

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
const runtime = createWorkerRuntime(executor, router, config.providers.map((provider) => provider.channel), config.batchLimit, { resolveRecipient: createDatabaseRecipientResolver(executor) });
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
