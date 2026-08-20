// Ownership: dependency-free GTFS-Realtime VehiclePositions protobuf encoding.

import type { GtfsRealtimeTripUpdate, GtfsRealtimeTripUpdatesFeed, GtfsRealtimeVehiclePosition, GtfsRealtimeVehiclePositionsFeed } from "./gtfs-realtime.js";

const encoder = new TextEncoder();

function varint(value: number): number[] {
  let remaining = Math.max(0, Math.floor(value));
  const bytes: number[] = [];
  do { bytes.push((remaining & 0x7f) | (remaining >= 0x80 ? 0x80 : 0)); remaining = Math.floor(remaining / 128); } while (remaining > 0);
  return bytes;
}

function fieldTag(field: number, wire: number): number[] { return varint((field << 3) | wire); }
function bytesField(field: number, value: Uint8Array): number[] { return [...fieldTag(field, 2), ...varint(value.length), ...value]; }
function stringField(field: number, value: string): number[] { return bytesField(field, encoder.encode(value)); }
function messageField(field: number, value: number[]): number[] { return bytesField(field, Uint8Array.from(value)); }
function uintField(field: number, value: number): number[] { return [...fieldTag(field, 0), ...varint(value)]; }
function floatField(field: number, value: number): number[] {
  const bytes = new Uint8Array(4); new DataView(bytes.buffer).setFloat32(0, value, true);
  return [...fieldTag(field, 5), ...bytes];
}

function tripDescriptor(position: GtfsRealtimeVehiclePosition): number[] {
  return [
    ...stringField(1, position.trip.tripPublicId ?? ""),
    ...stringField(5, position.trip.routePublicId ?? ""),
    ...stringField(3, position.trip.startDate),
  ];
}

function vehiclePosition(position: GtfsRealtimeVehiclePosition): number[] {
  const location = [
    ...floatField(1, position.latitude),
    ...floatField(2, position.longitude),
    ...(position.bearing === undefined ? [] : floatField(3, position.bearing)),
    ...(position.speedMetresPerSecond === undefined ? [] : floatField(5, position.speedMetresPerSecond)),
  ];
  return [
    ...messageField(1, tripDescriptor(position)),
    ...messageField(2, location),
    ...uintField(5, Math.floor(position.capturedAt.getTime() / 1_000)),
    ...messageField(8, stringField(1, position.vehiclePublicId)),
    ...(position.stopPublicId === undefined ? [] : stringField(8, position.stopPublicId)),
  ];
}

function entity(position: GtfsRealtimeVehiclePosition): number[] {
  return [...stringField(1, position.entityPublicId), ...messageField(4, vehiclePosition(position))];
}

function tripUpdateDescriptor(trip: GtfsRealtimeTripUpdate["trip"]): number[] {
  const relationship = trip.scheduleRelationship === "added" ? 1 : trip.scheduleRelationship === "unscheduled" ? 2 : trip.scheduleRelationship === "canceled" ? 3 : trip.scheduleRelationship === "duplicated" ? 5 : 0;
  return [...(trip.tripPublicId ? stringField(1, trip.tripPublicId) : []), ...(trip.startTime ? stringField(2, trip.startTime) : []), ...stringField(3, trip.startDate), ...(relationship ? uintField(4, relationship) : []), ...(trip.routePublicId ? stringField(5, trip.routePublicId) : [])];
}

function stopEvent(value: Date | undefined): number[] { return value ? uintField(2, Math.floor(value.getTime() / 1_000)) : []; }
function stopTimeUpdate(stop: GtfsRealtimeTripUpdate["stopUpdates"][number]): number[] {
  const relationship = stop.scheduleRelationship === "skipped" ? 1 : stop.scheduleRelationship === "no_data" ? 2 : stop.scheduleRelationship === "unscheduled" ? 3 : 0;
  return [...uintField(1, stop.stopSequence), ...stringField(2, stop.stopPublicId), ...(stop.arrivalAt ? messageField(3, stopEvent(stop.arrivalAt)) : []), ...(stop.departureAt ? messageField(4, stopEvent(stop.departureAt)) : []), ...(relationship ? uintField(5, relationship) : [])];
}

function tripUpdate(update: GtfsRealtimeTripUpdate): number[] {
  return [
    ...messageField(1, tripUpdateDescriptor(update.trip)),
    ...(update.vehiclePublicId ? messageField(2, stringField(1, update.vehiclePublicId)) : []),
    ...update.stopUpdates.map((stop) => messageField(3, stopTimeUpdate(stop))).flat(),
    ...uintField(4, Math.floor(update.capturedAt.getTime() / 1_000)),
  ];
}

function tripUpdateEntity(update: GtfsRealtimeTripUpdate): number[] { return [...stringField(1, update.entityPublicId), ...messageField(3, tripUpdate(update))]; }

export function serializeGtfsRealtimeVehiclePositions(feed: GtfsRealtimeVehiclePositionsFeed): Uint8Array {
  const header = [
    ...stringField(1, "2.0"),
    ...uintField(4, Math.floor(feed.generatedAt.getTime() / 1_000)),
  ];
  const body = [...messageField(1, header), ...feed.entities.flatMap((position) => messageField(2, entity(position)))];
  return Uint8Array.from(body);
}

export function serializeGtfsRealtimeTripUpdates(feed: GtfsRealtimeTripUpdatesFeed): Uint8Array {
  const header = [...stringField(1, "2.0"), ...uintField(4, Math.floor(feed.generatedAt.getTime() / 1_000))];
  const body = [...messageField(1, header), ...feed.entities.map((update) => messageField(2, tripUpdateEntity(update))).flat()];
  return Uint8Array.from(body);
}
