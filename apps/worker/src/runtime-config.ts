// Ownership: worker composition configuration. Environment values are validated before providers are built.

import type { CommunicationChannel } from "@bookingapp/domain";
import { readProviderConfig, type ProviderConfig } from "./provider-config.js";

export interface WorkerRuntimeConfig {
  databaseUrl: string;
  publicBaseUrl: string;
  providers: readonly ProviderConfig[];
  intervalMs: number;
  batchLimit: number;
  healthHost: string;
  healthPort: number;
}

const channels: readonly CommunicationChannel[] = ["email", "sms", "voice"];

export function readWorkerRuntimeConfig(env: Record<string, string | undefined>): WorkerRuntimeConfig {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const publicBaseUrl = env.PUBLIC_BASE_URL?.trim();
  if (!publicBaseUrl) throw new Error("PUBLIC_BASE_URL is required");
  const parsed = new URL(publicBaseUrl);
  if (parsed.protocol !== "https:") throw new Error("PUBLIC_BASE_URL must use HTTPS");
  const providers = channels.flatMap((channel) => {
    const config = readProviderConfig(env, channel);
    return config ? [config] : [];
  });
  const intervalMs = boundedInteger(env.WORKER_INTERVAL_MS, 15_000, 1_000, 300_000, "WORKER_INTERVAL_MS");
  const batchLimit = boundedInteger(env.WORKER_BATCH_LIMIT, 25, 1, 100, "WORKER_BATCH_LIMIT");
  const healthPort = boundedInteger(env.WORKER_HEALTH_PORT, 3200, 1, 65535, "WORKER_HEALTH_PORT");
  return { databaseUrl, publicBaseUrl: parsed.toString(), providers, intervalMs, batchLimit, healthHost: env.WORKER_HEALTH_HOST?.trim() || "127.0.0.1", healthPort };
}

function boundedInteger(raw: string | undefined, fallback: number, min: number, max: number, name: string): number {
  const value = raw === undefined || raw.trim() === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}`);
  return value;
}
