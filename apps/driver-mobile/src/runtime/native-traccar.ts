// Ownership: NIU Driver's native Traccar boundary. Session credentials are short-lived and provider-only.

import * as Traccar from 'react-native-traccar-client-sdk';

export interface NativeTraccarConfig {
  readonly serverUrl: string;
  readonly deviceId: string;
  /** The active session credential is sent as the SDK's OsmAnd device ID. */
  readonly deviceCredential?: string;
  readonly location?: Traccar.LocationConfig;
  readonly wakeLock?: boolean;
  readonly buffer?: boolean;
  readonly preferPlatformProviders?: boolean;
  readonly notification?: Traccar.NotificationConfig;
}

export interface NativeTraccarClient {
  readonly isAvailable: boolean;
  configure(config: NativeTraccarConfig): Promise<void>;
  setConfig(config: NativeTraccarConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  requestPosition(alarm?: string): Promise<boolean>;
  isTracking(): Promise<boolean>;
  getLogs(): Promise<readonly Traccar.LogEntry[]>;
  clearLogs(): Promise<void>;
}

const MAX_DEVICE_ID_LENGTH = 128;
const MAX_ALARM_LENGTH = 64;

function validateUrl(serverUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(serverUrl);
  } catch {
    throw new Error('Traccar server URL is invalid');
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) {
    throw new Error('Traccar server URL must be an HTTPS endpoint without credentials or fragments');
  }
}

function validateConfig(config: NativeTraccarConfig): void {
  if (!config || typeof config.serverUrl !== 'string') {
    throw new Error('Traccar configuration requires a server URL');
  }
  validateUrl(config.serverUrl);
  if (typeof config.deviceId !== 'string' || !config.deviceId.trim() || config.deviceId.length > MAX_DEVICE_ID_LENGTH) {
    throw new Error('Traccar device ID is missing or too long');
  }
  const credentialParts = config.deviceCredential?.split('.') ?? [];
  if (config.deviceCredential !== undefined && (!config.deviceCredential.startsWith('niu_traccar_v1.') || credentialParts.length !== 4 || (credentialParts[3]?.length ?? 0) < 32 || config.deviceCredential.length > 1024)) {
    throw new Error('Traccar device credential is invalid');
  }
}

function sdkConfig(config: NativeTraccarConfig): Traccar.Config {
  const { deviceCredential, ...rest } = config;
  return { ...rest, deviceId: deviceCredential ?? config.deviceId };
}

function validateAlarm(alarm: string | undefined): void {
  if (alarm !== undefined && (!alarm.trim() || alarm.length > MAX_ALARM_LENGTH)) {
    throw new Error('Traccar alarm is missing or too long');
  }
}

function sanitizeLogs(logs: readonly Traccar.LogEntry[]): readonly Traccar.LogEntry[] {
  return logs.filter((entry) => Number.isFinite(entry.time) && typeof entry.message === 'string').slice(-100);
}

export function createNativeTraccarClient(): NativeTraccarClient {
  return {
    isAvailable: true,
    async configure(config) {
      validateConfig(config);
      await Traccar.init(sdkConfig(config));
    },
    async setConfig(config) {
      validateConfig(config);
      await Traccar.setConfig(sdkConfig(config));
    },
    start: () => Traccar.start(),
    stop: () => Traccar.stop(),
    async requestPosition(alarm) {
      validateAlarm(alarm);
      return Traccar.requestPosition(alarm);
    },
    isTracking: () => Traccar.isTracking(),
    async getLogs() {
      return sanitizeLogs(await Traccar.getLogs());
    },
    clearLogs: () => Traccar.clearLogs(),
  };
}
