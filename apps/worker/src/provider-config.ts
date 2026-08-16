// Ownership: deployment configuration validation. Secrets are read at composition time and never logged.

import type { CommunicationChannel } from "@bookingapp/domain";

export interface ProviderConfig { channel: CommunicationChannel; providerName: string; endpoint: string; apiKey: string; timeoutMs: number; }

export function readProviderConfig(env: Record<string, string | undefined>, channel: CommunicationChannel): ProviderConfig | null {
  const prefix = channel.toUpperCase();
  const endpoint = env[`BOOKING_${prefix}_PROVIDER_ENDPOINT`];
  const apiKey = env[`BOOKING_${prefix}_PROVIDER_API_KEY`];
  if (!endpoint && !apiKey) return null;
  if (!endpoint || !apiKey) throw new Error(`${channel} provider requires endpoint and API key`);
  const parsed = new URL(endpoint);
  if (parsed.protocol !== "https:") throw new Error(`${channel} provider endpoint must use HTTPS`);
  const timeoutMs = Number(env[`BOOKING_${prefix}_PROVIDER_TIMEOUT_MS`] ?? "10000");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) throw new Error(`${channel} provider timeout must be between 1000 and 60000ms`);
  return { channel, providerName: env[`BOOKING_${prefix}_PROVIDER_NAME`] ?? channel, endpoint, apiKey, timeoutMs };
}
