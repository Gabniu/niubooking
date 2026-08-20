import assert from "node:assert/strict";
import test from "node:test";
import { cancelPublicTransportReservation, createPublicTransportReservation, fetchPublicLiveSession, fetchPublicLiveTrip, fetchPublicTransportTicket, fetchPublicTransportTrips, openPublicLiveStream, type PublicTransportEventSource } from "./transport-public-client.js";

const trip = { id: "trip-1", routeName: "Town → Airport", mode: "matatu", stops: [{ stopId: "Town", sequence: 1, boardingMinutes: 10, alightingMinutes: 2 }, { stopId: "Airport", sequence: 2, boardingMinutes: 5, alightingMinutes: 10 }], capacityMode: "seat", capacity: 14, remainingCapacity: 8, boardingStartsAt: "2026-09-01T06:00:00.000Z", boardingEndsAt: "2026-09-01T06:20:00.000Z" } as const;

test("loads public trips and keeps route stop data typed", async () => {
  const state = await fetchPublicTransportTrips(async (url) => { assert.match(url, /transport\/trips\?from=/u); return { ok: true, status: 200, json: async () => ({ data: [trip], error: null }) }; }, "https://booking.test", "qr-code", "2026-09-01");
  assert.equal(state.kind, "ready");
  if (state.kind === "ready") assert.equal(state.value[0]?.stops[1]?.stopId, "Airport");
});

test("maps a full trip to simple actionable copy", async () => {
  const state = await createPublicTransportReservation(async (_url, init) => { assert.equal(init?.method, "POST"); return { ok: false, status: 409, json: async () => ({ data: null, error: { code: "TRANSPORT_CAPACITY_FULL", message: "That trip is full." } }) }; }, "https://booking.test", "qr-code", "trip-1", { customerName: "Amina", originStopId: "Town", destinationStopId: "Airport", quantity: 1, idempotencyKey: "retry-key-123" });
  assert.deepEqual(state, { kind: "error", message: "That trip is full. Please choose another trip." });
});

test("cancels a reservation with its one-time manage capability", async () => {
  const state = await cancelPublicTransportReservation(async (url, init) => { assert.match(url, /reservations\/manage-token\/cancel/u); assert.equal(init?.method, "POST"); return { ok: true, status: 200, json: async () => ({ data: { reservationId: "reservation-1", tripId: "trip-1", status: "cancelled" }, error: null }) }; }, "https://booking.test", "manage-token", "retry-key-123");
  assert.equal(state.kind, "ready");
  if (state.kind === "ready") assert.equal(state.value.status, "cancelled");
});

test("loads a privacy-safe public ticket by opaque token", async () => {
  const state = await fetchPublicTransportTicket(async (url) => { assert.match(url, /transport\/tickets\/ticket-token/u); return { ok: true, status: 200, json: async () => ({ data: { routeName: "Town to Airport", mode: "bus", stops: [{ stopId: "Town", sequence: 1, boardingMinutes: 5, alightingMinutes: 0 }, { stopId: "Airport", sequence: 2, boardingMinutes: 0, alightingMinutes: 5 }], originStopId: "Town", destinationStopId: "Airport", quantity: 1, reservationStatus: "confirmed", status: "issued", fareAmountMinor: 25000, fareCurrency: "KES", issuedAt: "2026-09-01T07:00:00.000Z", boardingStartsAt: "2026-09-01T08:00:00.000Z", boardingEndsAt: "2026-09-01T08:20:00.000Z" }, error: null }) }; }, "https://booking.test", "ticket-token");
  assert.equal(state.kind, "ready");
  if (state.kind === "ready") assert.equal(state.value.routeName, "Town to Airport");
});

test("exchanges a ticket for an opaque short-lived live session", async () => {
  const state = await fetchPublicLiveSession(async (url, init) => { assert.match(url, /tickets\/ticket-token\/live-session$/u); assert.equal(init?.method, "POST"); return { ok: true, status: 200, json: async () => ({ data: { viewerToken: "viewer-token", expiresAt: "2026-09-01T07:15:00.000Z" }, error: null }) }; }, "https://booking.test", "ticket-token");
  assert.equal(state.kind, "ready");
  if (state.kind === "ready") assert.equal(state.value.viewerToken, "viewer-token");
});

test("loads a viewer-session live projection without exposing tenant scope", async () => {
  const state = await fetchPublicLiveTrip(async (url) => { assert.match(url, /transport\/live\/viewer-token$/u); return { ok: true, status: 200, json: async () => ({ data: { tripId: "trip-1", routeLabel: "Town to Airport", capturedAt: "2026-09-01T07:05:00.000Z", freshness: "live", latitude: -1.28, longitude: 36.81, accuracyMetres: 7, headingDegrees: 90, eta: null }, error: null }) }; }, "https://booking.test", "viewer-token");
  assert.equal(state.kind, "ready");
  if (state.kind === "ready") { assert.equal(state.value.tripId, "trip-1"); assert.equal(state.value.eta, null); assert.equal("tenantId" in state.value, false); }
});

test("parses public live stream snapshots and closes cleanly", () => {
  const listeners = new Map<string, (event: { data: string }) => void>();
  let closed = false;
  const source: PublicTransportEventSource = { addEventListener: (type, listener) => { listeners.set(type, listener); }, close: () => { closed = true; } };
  let snapshotTrip = "";
  let changes = 0;
  const close = openPublicLiveStream(() => source, "https://booking.test", "viewer-token", (value) => { snapshotTrip = value.tripId; }, () => { changes += 1; }, () => { changes += 10; });
  listeners.get("snapshot")?.({ data: JSON.stringify({ type: "snapshot", version: 1, response: { data: { tripId: "trip-1", routeLabel: "Town to Airport", capturedAt: null, freshness: "offline", latitude: null, longitude: null, accuracyMetres: null, headingDegrees: null, eta: null }, error: null } }) });
  listeners.get("changed")?.({ data: JSON.stringify({ type: "changed", version: 2, response: { data: null, error: { code: "LIVE_TRIP_CHANGED", message: "refresh" } } }) });
  assert.equal(snapshotTrip, "trip-1");
  assert.equal(changes, 1);
  close();
  assert.equal(closed, true);
});
