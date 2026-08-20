// Ownership: client-side fleet view filters over an already authorized snapshot.
"use client";

import type { LiveVehicleProjection } from "@bookingapp/contracts";

export type FleetFreshnessFilter = "all" | LiveVehicleProjection["freshness"];
export interface FleetFilters { readonly query: string; readonly route: string; readonly freshness: FleetFreshnessFilter; }

export function filterFleetVehicles(vehicles: readonly LiveVehicleProjection[], filters: FleetFilters): readonly LiveVehicleProjection[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return vehicles.filter((vehicle) => {
    const matchesQuery = !query || `${vehicle.vehicleLabel} ${vehicle.routeLabel} ${vehicle.tripId}`.toLocaleLowerCase().includes(query);
    const matchesRoute = filters.route === "all" || vehicle.routeLabel === filters.route;
    const matchesFreshness = filters.freshness === "all" || vehicle.freshness === filters.freshness;
    return matchesQuery && matchesRoute && matchesFreshness;
  });
}

export function FleetOperationsFilters({ vehicles, filters, onChange, onReset, resultCount }: { vehicles: readonly LiveVehicleProjection[]; filters: FleetFilters; onChange: (next: FleetFilters) => void; onReset: () => void; resultCount: number }) {
  const routes = [...new Set(vehicles.map((vehicle) => vehicle.routeLabel))].sort((a, b) => a.localeCompare(b));
  const update = (change: Partial<FleetFilters>) => onChange({ ...filters, ...change });
  const hasFilters = filters.query.trim().length > 0 || filters.route !== "all" || filters.freshness !== "all";
  return <div className="fleet-filters" aria-label="Filter live vehicles">
    <label><span>Search</span><input value={filters.query} onChange={(event) => update({ query: event.target.value })} placeholder="Vehicle or trip" /></label>
    <label><span>Route</span><select value={filters.route} onChange={(event) => update({ route: event.target.value })}><option value="all">All routes</option>{routes.map((route) => <option key={route} value={route}>{route}</option>)}</select></label>
    <label><span>Signal</span><select value={filters.freshness} onChange={(event) => update({ freshness: event.target.value as FleetFreshnessFilter })}><option value="all">Any signal</option><option value="live">Live</option><option value="delayed">Delayed</option><option value="signal_weak">Weak signal</option><option value="offline">Offline</option></select></label>
    <span className="fleet-filter-count" role="status">{resultCount} shown</span>
    {hasFilters && <button className="fleet-filter-reset" type="button" onClick={onReset}>Clear</button>}
  </div>;
}
