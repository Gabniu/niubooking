// Ownership: accessible, provider-free aggregate fleet view over admitted projections.
"use client";

import type { LiveVehicleProjection } from "@bookingapp/contracts";
import { buildFleetAggregateModel, projectFleetPoint, type FleetAggregateRoute } from "./fleet-aggregate-map-model.js";

const routeColors = ["#140ba7", "#0369a1", "#047857", "#b45309", "#be123c", "#6d28d9"];

function routeColor(index: number): string { return routeColors[index % routeColors.length] ?? "#140ba7"; }

function RouteShape({ route, index, bounds }: { route: FleetAggregateRoute; index: number; bounds: NonNullable<ReturnType<typeof buildFleetAggregateModel>["bounds"]> }) {
  const color = routeColor(index);
  return <><polyline className="fleet-aggregate-route" points={route.points.map((point) => { const [x, y] = projectFleetPoint(point, bounds); return `${x},${y}`; }).join(" ")} style={{ stroke: color }} /><g className="fleet-aggregate-route-label"><title>{`${route.label}: ${route.vehicleTripIds.length} vehicle${route.vehicleTripIds.length === 1 ? "" : "s"}`}</title></g></>;
}

export function FleetAggregateMap({ vehicles }: { vehicles: readonly LiveVehicleProjection[] }) {
  const model = buildFleetAggregateModel(vehicles);
  if (!model.bounds) return <section className="fleet-aggregate-map fleet-aggregate-empty" aria-labelledby="fleet-overview-map-title"><header><div><p className="eyebrow">Fleet overview</p><h3 id="fleet-overview-map-title">All vehicles</h3></div></header><p>Route coordinates are not available for the current vehicles yet.</p></section>;
  return <section className="fleet-aggregate-map" aria-labelledby="fleet-overview-map-title"><header><div><p className="eyebrow">Fleet overview</p><h3 id="fleet-overview-map-title">All vehicles</h3><p>{vehicles.length} visible vehicle{vehicles.length === 1 ? "" : "s"} across {model.routes.length} route{model.routes.length === 1 ? "" : "s"}.</p></div><span className="fleet-aggregate-legend">Live positions are approximate</span></header><div className="fleet-aggregate-canvas"><svg viewBox="0 0 100 100" role="img" aria-label="Aggregate live vehicle route overview"><g>{model.routes.map((route, index) => <RouteShape key={route.key} route={route} index={index} bounds={model.bounds!} />)}</g>{model.markers.map((marker) => { const [x, y] = projectFleetPoint([marker.longitude, marker.latitude], model.bounds!); return <circle className={`fleet-aggregate-marker fleet-aggregate-marker-${marker.freshness}`} key={marker.tripId} cx={x} cy={y} r="3"><title>{`${marker.vehicleLabel} · ${marker.routeLabel} · ${marker.freshness.replace("_", " ")}`}</title></circle>; })}</svg></div><ul className="fleet-aggregate-routes" aria-label="Visible routes">{model.routes.map((route, index) => <li key={route.key}><i style={{ backgroundColor: routeColor(index) }} aria-hidden="true" /><span>{route.label}</span><small>{route.vehicleTripIds.length} vehicle{route.vehicleTripIds.length === 1 ? "" : "s"}</small></li>)}</ul></section>;
}
