// Ownership: NIU Driver app edge. OS location events enter the existing session controller only.

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { createDriverMobileController, createNativeAuthSession, createNativeOsmAndTelemetryFetcher, createPersistentTelemetryQueue, type DriverLocationSample, type DriverMobileController } from '@bookingapp/driver-tracking';
import { createNativeOidcClient } from './native-oidc';
import { createSecureActiveSessionStorage, createSecureNativeAuthStorage, createSecureNativeRefreshTokenStorage } from './native-auth-storage';
import { readDriverRuntimeConfig } from './config';
import { createFileTelemetryQueueStorage } from './native-telemetry-storage';

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

type LocationTaskData = { readonly locations?: readonly Location.LocationObject[] };
type LocationTaskBody = TaskManager.TaskManagerTaskBody<LocationTaskData>;

let controllerPromise: Promise<DriverMobileController | null> | null = null;

function sampleFromLocation(location: Location.LocationObject, eventId: string): DriverLocationSample | null {
  const { latitude, longitude, accuracy, speed, heading } = location.coords;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    || accuracy === null || !Number.isFinite(accuracy) || accuracy < 0
    || !Number.isFinite(location.timestamp)) return null;
  const optionalSpeed = speed !== null && Number.isFinite(speed) && speed >= 0 ? { speedMetresPerSecond: speed } : {};
  const optionalHeading = heading !== null && Number.isFinite(heading) && heading >= 0 && heading <= 360 ? { headingDegrees: heading } : {};
  return {
    eventId,
    capturedAt: new Date(location.timestamp).toISOString(),
    latitude,
    longitude,
    accuracyMetres: accuracy,
    ...optionalSpeed,
    ...optionalHeading,
    provider: 'expo-location',
  };
}

async function createBackgroundController(): Promise<DriverMobileController | null> {
  const config = readDriverRuntimeConfig();
  if (!config) return null;
  const auth = createNativeAuthSession(createSecureNativeAuthStorage());
  const restored = await auth.restore();
  if (restored.status === 'expired' && config.authRefreshEnabled) {
    try {
      await createNativeOidcClient(config, auth, createSecureNativeRefreshTokenStorage()).refresh();
    } catch {
      return null;
    }
  }
  if (!auth.getAccessToken()) return null;
  const controller = createDriverMobileController({
    auth,
    queue: createPersistentTelemetryQueue(createFileTelemetryQueueStorage()),
    activeSessionStorage: createSecureActiveSessionStorage(),
    sessionFetcher: fetch,
    telemetryFetcher: createNativeOsmAndTelemetryFetcher(async (url, init) => {
      const response = await fetch(url, init);
      return { status: response.status };
    }),
    apiBaseUrl: config.apiBaseUrl,
    telemetryEndpoint: config.telemetryEndpoint,
  });
  const snapshot = await controller.restore();
  return snapshot.phase === 'sharing' ? controller : null;
}

async function getController(): Promise<DriverMobileController | null> {
  if (!controllerPromise) controllerPromise = createBackgroundController();
  const controller = await controllerPromise;
  if (!controller) controllerPromise = null;
  return controller;
}

async function stopRegisteredTask(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
    }
  } catch {
    // A task can disappear while the OS is shutting down the app.
  }
}

async function handleLocationTask({ data, error, executionInfo }: LocationTaskBody): Promise<void> {
  if (error || !data?.locations?.length) return;
  const controller = await getController();
  if (!controller) {
    await stopRegisteredTask();
    return;
  }
  for (const [index, location] of data.locations.entries()) {
    const sample = sampleFromLocation(location, `${executionInfo.eventId}:${index}`);
    if (!sample) continue;
    const snapshot = await controller.record(sample);
    if (snapshot.phase === 'error' || snapshot.phase === 'signed_out') {
      await stopRegisteredTask();
      return;
    }
  }
}

TaskManager.defineTask<LocationTaskData>(DRIVER_LOCATION_TASK, handleLocationTask);

const defaultOptions: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 15_000,
  distanceInterval: 25,
  deferredUpdatesInterval: 15_000,
  deferredUpdatesDistance: 25,
  activityType: Location.ActivityType.AutomotiveNavigation,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'NIU Driver location sharing',
    notificationBody: 'Location updates are active for your assigned trip.',
    notificationColor: '#140BA7',
    killServiceOnDestroy: false,
  },
};

export function createNativeLocationTask(options: Location.LocationTaskOptions = defaultOptions): NativeLocationTask {
  return {
    async requestPermissions() {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (foreground.status !== 'granted') return { kind: 'denied', scope: 'foreground' };
      const background = await Location.requestBackgroundPermissionsAsync();
      return background.status === 'granted' ? { kind: 'granted' } : { kind: 'denied', scope: 'background' };
    },
    async start() {
      if (!await Location.isBackgroundLocationAvailableAsync()) throw new Error('Background location is unavailable');
      if (!await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
        await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, options);
      }
    },
    stop: stopRegisteredTask,
    isRunning() {
      return Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
    },
  };
}
