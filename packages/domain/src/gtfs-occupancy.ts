// Ownership: conservative occupancy projection from authoritative seat inventory.

export type GtfsRealtimeOccupancyStatus =
  | "empty"
  | "many_seats_available"
  | "few_seats_available"
  | "standing_room_only"
  | "crushed_standing_room_only"
  | "full"
  | "not_accepting_passengers";

/**
 * Maps reserved seats to the GTFS-Realtime vocabulary. This intentionally
 * returns no claim for open-capacity or malformed sources; walk-in riders are
 * not observable from reservation inventory alone.
 */
export function occupancyStatusFromSeatLoad(
  capacityMode: "seat" | "open" | undefined,
  reservedQuantity: number | null | undefined,
  capacity: number | null | undefined,
): GtfsRealtimeOccupancyStatus | undefined {
  if (capacityMode !== "seat" || typeof reservedQuantity !== "number" || typeof capacity !== "number" || !Number.isInteger(reservedQuantity) || !Number.isInteger(capacity) || capacity <= 0 || reservedQuantity < 0) return undefined;
  const ratio = Math.min(1, reservedQuantity / capacity);
  if (ratio === 0) return "empty";
  if (ratio <= 0.25) return "many_seats_available";
  if (ratio <= 0.5) return "few_seats_available";
  if (ratio < 0.9) return "standing_room_only";
  if (ratio < 1) return "crushed_standing_room_only";
  return "full";
}
