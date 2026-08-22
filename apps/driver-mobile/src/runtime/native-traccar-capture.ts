// Ownership: NIU Driver session-to-provider lifecycle; OS SDK details stay behind native-traccar.

import type { DriverActiveSession, DriverCaptureLifecycle } from '@bookingapp/driver-tracking';
import { createNativeTraccarClient, type NativeTraccarClient } from './native-traccar';

export interface NativeTraccarCaptureConfig {
  readonly apiBaseUrl: string;
  readonly client?: NativeTraccarClient;
}

function endpoint(apiBaseUrl: string): string {
  const url = new URL('/v1/fleet/telemetry/osmand', apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`);
  return url.toString();
}

export function createNativeTraccarCapture(config: NativeTraccarCaptureConfig): DriverCaptureLifecycle {
  const client = config.client ?? createNativeTraccarClient();
  return {
    async start(session: DriverActiveSession) {
      const providerConfig = {
        serverUrl: endpoint(config.apiBaseUrl),
        deviceId: session.deviceId,
        deviceCredential: session.traccarCredential,
        location: { accuracy: 'HIGH' as const, distanceMeters: 25, intervalSeconds: 15, stopDetection: true, stopTimeoutSeconds: 120, heartbeatIntervalSeconds: 60 },
        wakeLock: true,
        buffer: true,
        notification: { text: 'NIU Driver location sharing' },
      };
      await client.configure(providerConfig);
      await client.setConfig(providerConfig);
      await client.start();
    },
    stop: () => client.stop(),
  };
}
