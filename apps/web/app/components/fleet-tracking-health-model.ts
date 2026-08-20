// Ownership: pure summary of the already authorized fleet projection for staff health UI.
import type { LiveVehicleProjection } from "@bookingapp/contracts";

export type FleetHealthLevel = "healthy" | "attention" | "offline";
export interface FleetHealthSummary { readonly total: number; readonly live: number; readonly delayed: number; readonly signalWeak: number; readonly offline: number; readonly level: FleetHealthLevel; readonly assignedScope: boolean; }

export function summarizeFleetHealth(vehicles: readonly LiveVehicleProjection[], role: string): FleetHealthSummary {
  const live = vehicles.filter((vehicle) => vehicle.freshness === "live").length;
  const delayed = vehicles.filter((vehicle) => vehicle.freshness === "delayed").length;
  const signalWeak = vehicles.filter((vehicle) => vehicle.freshness === "signal_weak").length;
  const offline = vehicles.filter((vehicle) => vehicle.freshness === "offline").length;
  const level: FleetHealthLevel = live === 0 && offline > 0 ? "offline" : delayed + signalWeak + offline > 0 ? "attention" : "healthy";
  return { total: vehicles.length, live, delayed, signalWeak, offline, level, assignedScope: role === "driver" || role === "conductor" };
}
