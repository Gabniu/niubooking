// Ownership: runtime configuration only. Secrets and refresh credentials never belong here.

import Constants from 'expo-constants';

export interface DriverRuntimeConfig {
  readonly apiBaseUrl: string;
  readonly telemetryEndpoint: string;
  readonly authIssuer: string;
  readonly authClientId: string;
  readonly authRedirectUri: string;
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

export function readDriverRuntimeConfig(extra: unknown = Constants.expoConfig?.extra): DriverRuntimeConfig | null {
  if (!extra || typeof extra !== 'object') return null;
  const values = extra as RuntimeExtra;
  if (!httpsUrl(values.apiBaseUrl) || !httpsUrl(values.telemetryEndpoint) || !httpsUrl(values.authIssuer)) return null;
  if (!values.authClientId || !values.authRedirectUri?.startsWith('niudriver://')) return null;
  return {
    apiBaseUrl: values.apiBaseUrl,
    telemetryEndpoint: values.telemetryEndpoint,
    authIssuer: values.authIssuer,
    authClientId: values.authClientId,
    authRedirectUri: values.authRedirectUri,
  };
}
