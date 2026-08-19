import assert from "node:assert/strict";
import test from "node:test";
import { assignTransportReservationSeats, boardTransportTicket, fetchTransportManifest, fetchTransportTrips } from "./transport-staff-client.js";

test("loads tenant transport trips with a bounded date window", async () => {
  const state = await fetchTransportTrips(async (url) => { assert.match(url, /transport\/trips\?from=/u); return { status: 200, json: async () => ({ data: [], error: null }) }; }, "https://booking.test", "tenant-1", "2026-09-01T06:00:00.000Z", "2026-09-01T12:00:00.000Z");
  assert.deepEqual(state, { kind: "ready", value: [] });
});

test("loads a manifest and keeps empty manifests honest", async () => {
  const state = await fetchTransportManifest(async (url) => { assert.match(url, /manifest$/u); return { status: 200, json: async () => ({ data: [], error: null }) }; }, "https://booking.test", "tenant-1", "trip-1");
  assert.deepEqual(state, { kind: "ready", value: [] });
});

test("maps an already-boarded conflict to simple staff copy", async () => {
  const state = await boardTransportTicket(async (_url, init) => { assert.equal(init.method, "POST"); return { status: 409, json: async () => ({ data: null, error: { code: "TRANSPORT_BOARDING_CONFLICT", message: "This ticket has already been boarded." } }) }; }, "https://booking.test", "tenant-1", "trip-1", "ticket-1", "retry-key-123");
  assert.deepEqual(state, { kind: "error", message: "This ticket cannot be boarded now." });
});

test("maps a seat conflict to simple staff copy", async () => {
  const state = await assignTransportReservationSeats(async (_url, init) => { assert.equal(init.method, "POST"); assert.match(init.body ?? "", /seatLabels/iu); return { status: 409, json: async () => ({ data: null, error: { code: "TRANSPORT_SEAT_CONFLICT", message: "One of those seats was just taken." } }) }; }, "https://booking.test", "tenant-1", "trip-1", "reservation-1", ["1"]);
  assert.deepEqual(state, { kind: "error", message: "One of those seats was just taken. Please choose different seats." });
});
