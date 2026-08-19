import assert from "node:assert/strict";
import test from "node:test";
import { cancelPublicTransportReservation, createPublicTransportReservation, fetchPublicTransportTrips } from "./transport-public-client.js";

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
