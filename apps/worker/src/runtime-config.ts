// Ownership: worker composition configuration. Environment values are validated before providers are built.

import type { CommunicationChannel } from "@bookingapp/domain";
import { readProviderConfig, type ProviderConfig } from "./provider-config.js";

export interface WorkerRuntimeConfig {
  databaseUrl: string;
  publicBaseUrl: string;
  providers: readonly ProviderConfig[];
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
  return { databaseUrl, publicBaseUrl: parsed.toString(), providers };
}
