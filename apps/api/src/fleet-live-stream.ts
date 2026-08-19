// Ownership: replaceable realtime fan-out boundary; no tenant data crosses subscriptions.

import type { FleetStreamEvent } from "@bookingapp/contracts";

export type FleetStreamListener = (event: FleetStreamEvent) => void | Promise<void>;

export interface FleetLiveStream {
  subscribe(tenantId: string, listener: FleetStreamListener): () => void;
  publish(tenantId: string, event: FleetStreamEvent): void;
}

export function createFleetLiveStream(): FleetLiveStream {
  const listeners = new Map<string, Set<FleetStreamListener>>();
  return {
    subscribe(tenantId, listener) {
      const bucket = listeners.get(tenantId) ?? new Set<FleetStreamListener>();
      bucket.add(listener);
      listeners.set(tenantId, bucket);
      return () => { bucket.delete(listener); if (!bucket.size) listeners.delete(tenantId); };
    },
    publish(tenantId, event) {
      for (const listener of listeners.get(tenantId) ?? []) void listener(event);
    },
  };
}
