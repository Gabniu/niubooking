// Ownership: NIU Driver app edge. Location samples persist locally for offline replay; the server remains authoritative.

import * as FileSystem from 'expo-file-system/legacy';
import type { DriverPositionUpload } from '@bookingapp/contracts';
import type { DriverTelemetryQueueStorage } from '@bookingapp/driver-tracking';

const QUEUE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}niu-driver.telemetry-queue.v1.json`
  : null;

function parseQueue(value: string): readonly DriverPositionUpload[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('Stored telemetry queue is invalid');
  return parsed as readonly DriverPositionUpload[];
}

export function createFileTelemetryQueueStorage(uri = QUEUE_URI): DriverTelemetryQueueStorage {
  if (!uri) {
    return {
      read: async () => [],
      write: async () => { throw new Error('Native file storage is unavailable'); },
    };
  }

  return {
    async read() {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) return [];
      try {
        return parseQueue(await FileSystem.readAsStringAsync(uri));
      } catch {
        throw new Error('Stored telemetry queue is invalid');
      }
    },
    async write(values) {
      const temporaryUri = `${uri}.tmp`;
      await FileSystem.writeAsStringAsync(temporaryUri, JSON.stringify(values));
      await FileSystem.deleteAsync(uri, { idempotent: true });
      await FileSystem.moveAsync({ from: temporaryUri, to: uri });
    },
  };
}
