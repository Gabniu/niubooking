// Ownership: focused proof for staff tracking-health and assigned-scope summaries.
import assert from "node:assert/strict";
import test from "node:test";
import { summarizeFleetHealth } from "../app/components/fleet-tracking-health-model.js";
import type { LiveVehicleProjection } from "@bookingapp/contracts";

const vehicle = (freshness: LiveVehicleProjection["freshness"]): LiveVehicleProjection => ({ tripId: freshness, branchId: "branch-1", vehicleLabel: freshness, routeLabel: "CBD", capturedAt: freshness === "offline" ? null : "2026-08-20T08:00:00.000Z", freshness, latitude: null, longitude: null, accuracyMetres: null, headingDegrees: null, eta: null });

test("summarizes live and attention signals for workspace staff", () => {
  const summary = summarizeFleetHealth([vehicle("live"), vehicle("delayed"), vehicle("signal_weak")], "manager");
  assert.deepEqual({ total: summary.total, live: summary.live, delayed: summary.delayed, signalWeak: summary.signalWeak, offline: summary.offline, level: summary.level, assignedScope: summary.assignedScope }, { total: 3, live: 1, delayed: 1, signalWeak: 1, offline: 0, level: "attention", assignedScope: false });
});

test("marks a driver assignment offline when no live signal exists", () => {
  const summary = summarizeFleetHealth([vehicle("offline")], "driver");
  assert.equal(summary.level, "offline");
  assert.equal(summary.assignedScope, true);
});

test("marks an all-live conductor view healthy", () => {
  const summary = summarizeFleetHealth([vehicle("live"), vehicle("live")], "conductor");
  assert.equal(summary.level, "healthy");
  assert.equal(summary.assignedScope, true);
});
