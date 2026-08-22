// Ownership: runtime configuration only. Secrets and refresh credentials never belong here.

import Constants from 'expo-constants';

export interface DriverRuntimeConfig {
  readonly apiBaseUrl: string;
  readonly telemetryEndpoint: string;
  readonly authIssuer: string;
  readonly authClientId: string;
  readonly authRedirectUri: string;
  readonly authRefreshEnabled: boolean;
}

type RuntimeExtra = Partial<DriverRuntimeConfig>;

function httpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function osmandTelemetryUrl(value: unknown): value is string {
  if (!httpsUrl(value)) return false;
  try {
    return new URL(value).pathname.replace(/\/+$/u, '') === '/v1/fleet/telemetry/osmand';
  } catch {
    return false;
  }
}

export function readDriverRuntimeConfig(extra: unknown = Constants.expoConfig?.extra): DriverRuntimeConfig | null {
  if (!extra || typeof extra !== 'object') return null;
  const values = extra as RuntimeExtra;
  if (!httpsUrl(values.apiBaseUrl) || !osmandTelemetryUrl(values.telemetryEndpoint) || !httpsUrl(values.authIssuer)) return null;
  if (!values.authClientId || !values.authRedirectUri?.startsWith('niudriver://')) return null;
  return {
    apiBaseUrl: values.apiBaseUrl,
    telemetryEndpoint: values.telemetryEndpoint,
    authIssuer: values.authIssuer,
    authClientId: values.authClientId,
    authRedirectUri: values.authRedirectUri,
    authRefreshEnabled: values.authRefreshEnabled === true,
  };
}
