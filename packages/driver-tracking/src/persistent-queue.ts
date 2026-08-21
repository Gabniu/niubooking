// Ownership: durable native telemetry queue; the app supplies encrypted/local persistence.

import type { DriverPositionUpload } from "@bookingapp/contracts";
import type { DriverTelemetryQueue } from "./index.js";

export interface DriverTelemetryQueueStorage {
  read(): Promise<readonly DriverPositionUpload[]>;
  write(values: readonly DriverPositionUpload[]): Promise<void>;
}

function isPosition(value: DriverPositionUpload): boolean {
  return typeof value.sessionId === "string" && value.sessionId.length > 0
    && typeof value.eventId === "string" && value.eventId.length > 0
    && Number.isInteger(value.sequence) && value.sequence >= 0
    && typeof value.capturedAt === "string"
    && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    && Number.isFinite(value.accuracyMetres) && value.accuracyMetres >= 0;
}

function checked(values: readonly DriverPositionUpload[]): DriverPositionUpload[] {
  if (!values.every(isPosition)) throw new Error("Stored telemetry queue is invalid");
  return values.slice();
}

export function createPersistentTelemetryQueue(storage: DriverTelemetryQueueStorage): DriverTelemetryQueue {
  let loaded = false;
  let values: DriverPositionUpload[] = [];
  let mutation: Promise<void> = Promise.resolve();

  const load = async (): Promise<void> => {
    if (loaded) return;
    values = checked(await storage.read());
    loaded = true;
  };
  const mutate = (change: (current: readonly DriverPositionUpload[]) => DriverPositionUpload[]): Promise<void> => {
    const next = mutation.then(async () => {
      await load();
      const candidate = change(values);
      await storage.write(candidate);
      values = candidate;
    });
    mutation = next.catch(() => undefined);
    return next;
  };

  return {
    async read() {
      await mutation;
      await load();
      return values.slice();
    },
    append(position) { return mutate((current) => [...current, position]); },
    removeFirst() { return mutate((current) => current.slice(1)); },
  };
}
