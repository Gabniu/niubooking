// Ownership: NIU Driver web fallback. Web export must not load or emulate the native tracking SDK.

import type { NativeTraccarClient, NativeTraccarConfig } from './native-traccar';

export function createNativeTraccarClient(): NativeTraccarClient {
  const unavailable = async (): Promise<never> => {
    throw new Error('Traccar background tracking requires a native development build');
  };

  return {
    isAvailable: false,
    configure: (_config: NativeTraccarConfig) => unavailable(),
    setConfig: (_config: NativeTraccarConfig) => unavailable(),
    start: unavailable,
    stop: unavailable,
    requestPosition: (_alarm?: string) => unavailable(),
    isTracking: unavailable,
    getLogs: unavailable,
    clearLogs: unavailable,
  };
}
