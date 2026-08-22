// Ownership: NIU Driver web boundary. Browser export does not persist native telemetry samples.

import type { DriverTelemetryQueueStorage } from '@bookingapp/driver-tracking';

export function createFileTelemetryQueueStorage(): DriverTelemetryQueueStorage {
  return {
    read: async () => [],
    write: async () => { throw new Error('Native telemetry storage is unavailable on the web'); },
  };
}
