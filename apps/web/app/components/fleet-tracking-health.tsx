// Ownership: compact staff tracking-health and assigned-trip context; actions stay behind server contracts.
"use client";

import type { LiveVehicleProjection } from "@bookingapp/contracts";
import { summarizeFleetHealth, type FleetHealthSummary } from "./fleet-tracking-health-model.js";

const levelCopy: Record<FleetHealthSummary["level"], { label: string; detail: string }> = { healthy: { label: "Tracking healthy", detail: "All visible vehicles have a live signal." }, attention: { label: "Some signals need attention", detail: "Review delayed, weak, or offline vehicles." }, offline: { label: "No live signal", detail: "Start or reconnect a driver tracking session." } };

function HealthCount({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className={`fleet-health-count fleet-health-count-${tone}`}><strong>{value}</strong><span>{label}</span></div>; }

export function FleetTrackingHealth({ vehicles, role }: { vehicles: readonly LiveVehicleProjection[]; role: string }) {
  const summary = summarizeFleetHealth(vehicles, role); const copy = levelCopy[summary.level];
  return <section className="fleet-health" aria-labelledby="fleet-health-title"><header><div><p className="eyebrow">Tracking health</p><h3 id="fleet-health-title">{summary.assignedScope ? "Your assigned trip" : "Workspace fleet"}</h3><p>{summary.assignedScope ? "This view is limited to trips assigned to you." : "A quick signal check for the visible fleet."}</p></div><span className={`fleet-health-status fleet-health-status-${summary.level}`}><i aria-hidden="true" />{copy.label}</span></header><div className="fleet-health-summary"><strong>{summary.total}</strong><span>{summary.assignedScope ? "assigned vehicle" : "visible vehicle"}{summary.total === 1 ? "" : "s"}</span><small>{copy.detail}</small></div><div className="fleet-health-counts"><HealthCount label="Live" value={summary.live} tone="live" /><HealthCount label="Delayed" value={summary.delayed} tone="delayed" /><HealthCount label="Weak" value={summary.signalWeak} tone="weak" /><HealthCount label="Offline" value={summary.offline} tone="offline" /></div><p className="fleet-health-note">Driver location sharing is managed from the NIU Driver app; this workspace shows the authorized result.</p></section>;
}
