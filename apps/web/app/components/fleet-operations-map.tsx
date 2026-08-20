// Ownership: compact staff route context; geometry is limited to the admitted fleet projection.
"use client";

import type { LiveVehicleProjection } from "@bookingapp/contracts";
import { TransportInteractiveMap } from "./transport-interactive-map.js";
import { FleetAggregateMap } from "./fleet-aggregate-map.js";

const mapStyleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "";

function positionFor(vehicle: LiveVehicleProjection) {
  return { latitude: vehicle.latitude, longitude: vehicle.longitude, capturedAt: vehicle.capturedAt };
}

function RouteMapCard({ vehicle }: { vehicle: LiveVehicleProjection }) {
  return <article className="fleet-map-card">
    <header><div><strong>{vehicle.vehicleLabel}</strong><span>{vehicle.routeLabel}</span></div><small>{vehicle.freshness === "live" ? "Live position" : "Last known position"}</small></header>
    <TransportInteractiveMap geometry={vehicle.geometry} stops={vehicle.stops ?? []} livePosition={positionFor(vehicle)} styleUrl={mapStyleUrl} smoothLivePosition={vehicle.freshness === "live"} label={`Live route for ${vehicle.vehicleLabel}`} />
  </article>;
}

export function FleetOperationsMap({ vehicles }: { vehicles: readonly LiveVehicleProjection[] }) {
  return <section className="fleet-map-section" aria-labelledby="fleet-map-title">
    <header className="fleet-map-heading"><div><p className="eyebrow">Route context</p><h3 id="fleet-map-title">Live vehicle map</h3><p>Each map stays scoped to the vehicles visible in this workspace.</p></div><span className="fleet-map-legend"><i aria-hidden="true" /> vehicle position</span></header>
    <FleetAggregateMap vehicles={vehicles} />
    <div className="fleet-map-grid">{vehicles.map((vehicle) => <RouteMapCard key={`${vehicle.tripId}-${vehicle.vehicleLabel}`} vehicle={vehicle} />)}</div>
  </section>;
}
