import assert from "node:assert/strict";
import test from "node:test";
import { validateTransportRouteDraft, validateTransportSeatAssignment, validateTransportTripDraft, type TransportRouteDraft } from "./transport.js";

const startsAt = new Date("2026-09-01T07:00:00Z");
const endsAt = new Date("2026-09-01T10:00:00Z");
const route: TransportRouteDraft = { id: "route-1", tenantId: "tenant-1", version: 1, name: "CBD — Westlands", mode: "matatu", stops: [{ stopId: "cbd", sequence: 1, boardingMinutes: 10, alightingMinutes: 0 }, { stopId: "westlands", sequence: 2, boardingMinutes: 10, alightingMinutes: 10 }] };

test("accepts an ordered transport route with versioned stops", () => {
  assert.deepEqual(validateTransportRouteDraft(route), []);
});

test("accepts named geocoded stops and bounded route geometry", () => {
  assert.deepEqual(validateTransportRouteDraft({ ...route, stops: [{ ...route.stops[0]!, label: "CBD station", longitude: 36.8219, latitude: -1.2921 }, { ...route.stops[1]!, label: "Westlands", longitude: 36.8044, latitude: -1.2676 }], geometry: { type: "LineString", coordinates: [[36.8219, -1.2921], [36.8044, -1.2676]] } }), []);
});

test("rejects unpaired stop coordinates and invalid route geometry", () => {
  const errors = validateTransportRouteDraft({ ...route, stops: [{ ...route.stops[0]!, latitude: -1.2 }, route.stops[1]!], geometry: { type: "LineString", coordinates: [[36.8, -1.2], [181, -1.1]] } });
  assert.match(errors.join("; "), /coordinates|geometry/iu);
});

test("rejects repeated or gapped route stops", () => {
  const errors = validateTransportRouteDraft({ ...route, stops: [{ ...route.stops[0]!, sequence: 1 }, { ...route.stops[1]!, stopId: "cbd", sequence: 3 }] });
  assert.match(errors.join(";"), /repeat|consecutive/iu);
});

test("accepts a trip whose boarding window fits its occurrence", () => {
  const trip = { id: "trip-1", tenantId: "tenant-1", branchId: "branch-1", routeId: "route-1", routeVersion: 1, occurrenceId: "occurrence-1", capacityMode: "open" as const, capacity: 33, boardingStartsAt: new Date("2026-09-01T07:00:00Z"), boardingEndsAt: new Date("2026-09-01T07:30:00Z") };
  assert.deepEqual(validateTransportTripDraft(trip, route, { id: "occurrence-1", tenantId: "tenant-1", startsAt, endsAt }), []);
});

test("rejects cross-tenant, stale-route, and out-of-window trips", () => {
  const errors = validateTransportTripDraft({ id: "trip-1", tenantId: "tenant-2", branchId: "branch-1", routeId: "route-1", routeVersion: 2, occurrenceId: "occurrence-2", capacityMode: "seat", capacity: 0, boardingStartsAt: new Date("2026-09-01T06:00:00Z"), boardingEndsAt: new Date("2026-09-01T11:00:00Z") }, route, { id: "occurrence-1", tenantId: "tenant-1", startsAt, endsAt });
  assert.match(errors.join(";"), /tenant|current|capacity|before|after|match/iu);
});

test("validates seat assignments without changing open-capacity trips", () => {
  assert.deepEqual(validateTransportSeatAssignment({ capacityMode: "seat", capacity: 4, quantity: 2, seatLabels: ["1", "4"] }), []);
  assert.match(validateTransportSeatAssignment({ capacityMode: "open", capacity: 4, quantity: 1, seatLabels: ["1"] }).join("; "), /seat-based/iu);
  assert.match(validateTransportSeatAssignment({ capacityMode: "seat", capacity: 4, quantity: 2, seatLabels: ["1", "1"] }).join("; "), /same seat/iu);
});
