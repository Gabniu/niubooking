// Ownership: NIU Driver web boundary. Background location is unavailable on the web and must fail closed.

export const DRIVER_LOCATION_TASK = 'niu-driver.location-updates.v1';

export type NativeLocationPermission =
  | { readonly kind: 'granted' }
  | { readonly kind: 'denied'; readonly scope: 'foreground' | 'background' };

export interface NativeLocationTask {
  requestPermissions(): Promise<NativeLocationPermission>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
}

export function createNativeLocationTask(): NativeLocationTask {
  return {
    requestPermissions: async () => ({ kind: 'denied', scope: 'background' }),
    start: async () => { throw new Error('Background location is unavailable on the web'); },
    stop: async () => undefined,
    isRunning: async () => false,
  };
}
