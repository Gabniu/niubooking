// Ownership: pure, privacy-safe geometry model for the staff aggregate fleet overview.
import type { LiveVehicleProjection } from "@bookingapp/contracts";

export type FleetMapPoint = readonly [longitude: number, latitude: number];
export interface FleetAggregateRoute { readonly key: string; readonly label: string; readonly points: readonly FleetMapPoint[]; readonly vehicleTripIds: readonly string[]; }
export interface FleetAggregateMarker { readonly tripId: string; readonly vehicleLabel: string; readonly routeLabel: string; readonly longitude: number; readonly latitude: number; readonly freshness: LiveVehicleProjection["freshness"]; }
export interface FleetAggregateBounds { readonly minLongitude: number; readonly maxLongitude: number; readonly minLatitude: number; readonly maxLatitude: number; }
export interface FleetAggregateModel { readonly routes: readonly FleetAggregateRoute[]; readonly markers: readonly FleetAggregateMarker[]; readonly bounds: FleetAggregateBounds | null; }

function finitePoint(point: readonly number[]): point is FleetMapPoint { return point.length === 2 && point.every(Number.isFinite); }
function pointsFor(vehicle: LiveVehicleProjection): readonly FleetMapPoint[] {
  if (vehicle.geometry?.coordinates && vehicle.geometry.coordinates.length >= 2) return vehicle.geometry.coordinates.filter(finitePoint);
  return (vehicle.stops ?? []).flatMap((stop) => typeof stop.longitude === "number" && typeof stop.latitude === "number" && Number.isFinite(stop.longitude) && Number.isFinite(stop.latitude) ? [[stop.longitude, stop.latitude] as const] : []);
}

export function buildFleetAggregateModel(vehicles: readonly LiveVehicleProjection[]): FleetAggregateModel {
  const routes = new Map<string, { label: string; points: readonly FleetMapPoint[]; vehicleTripIds: string[] }>();
  const markers: FleetAggregateMarker[] = [];
  for (const vehicle of vehicles) {
    const points = pointsFor(vehicle);
    if (points.length >= 2) {
      const key = vehicle.routeLabel || vehicle.tripId;
      const existing = routes.get(key);
      if (existing) existing.vehicleTripIds.push(vehicle.tripId);
      else routes.set(key, { label: vehicle.routeLabel || "Route", points, vehicleTripIds: [vehicle.tripId] });
    }
    if (typeof vehicle.longitude === "number" && typeof vehicle.latitude === "number" && Number.isFinite(vehicle.longitude) && Number.isFinite(vehicle.latitude)) markers.push({ tripId: vehicle.tripId, vehicleLabel: vehicle.vehicleLabel, routeLabel: vehicle.routeLabel, longitude: vehicle.longitude, latitude: vehicle.latitude, freshness: vehicle.freshness });
  }
  const routeList = [...routes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, route]) => ({ key, ...route, vehicleTripIds: [...route.vehicleTripIds] }));
  const allPoints = [...routeList.flatMap((route) => route.points), ...markers.map((marker) => [marker.longitude, marker.latitude] as const)];
  if (!allPoints.length) return { routes: routeList, markers, bounds: null };
  const longitudes = allPoints.map(([longitude]) => longitude); const latitudes = allPoints.map(([, latitude]) => latitude);
  return { routes: routeList, markers, bounds: { minLongitude: Math.min(...longitudes), maxLongitude: Math.max(...longitudes), minLatitude: Math.min(...latitudes), maxLatitude: Math.max(...latitudes) } };
}

export function projectFleetPoint(point: FleetMapPoint, bounds: FleetAggregateBounds): FleetMapPoint {
  const longitudeRange = bounds.maxLongitude - bounds.minLongitude; const latitudeRange = bounds.maxLatitude - bounds.minLatitude;
  return [longitudeRange === 0 ? 50 : 8 + ((point[0] - bounds.minLongitude) / longitudeRange) * 84, latitudeRange === 0 ? 50 : 92 - ((point[1] - bounds.minLatitude) / latitudeRange) * 84];
}
