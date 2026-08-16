import assert from "node:assert/strict";
import test from "node:test";
import { findAvailableResourceSlots, findAvailableStarts, validateBookingDraft } from "./booking.js";

test("accepts an ordered appointment draft", () => {
  assert.deepEqual(validateBookingDraft({ id: "b-1", tenantId: "t-1", customerId: "c-1", serviceName: "Consultation", startsAt: new Date("2026-08-14T09:00:00Z"), endsAt: new Date("2026-08-14T09:30:00Z") }), []);
});

test("rejects empty services and reversed times", () => {
  assert.equal(validateBookingDraft({ id: "b-1", tenantId: "t-1", customerId: "c-1", serviceName: " ", startsAt: new Date("2026-08-14T10:00:00Z"), endsAt: new Date("2026-08-14T09:00:00Z") }).length, 2);
});

test("finds advisory slots without treating cancelled bookings as conflicts", () => {
  const from = new Date("2026-08-14T09:00:00Z");
  const slots = findAvailableStarts([{ startsAt: new Date("2026-08-14T09:30:00Z"), endsAt: new Date("2026-08-14T10:00:00Z"), status: "scheduled" }, { startsAt: new Date("2026-08-14T09:00:00Z"), endsAt: new Date("2026-08-14T09:30:00Z"), status: "cancelled" }], { from, to: new Date("2026-08-14T11:00:00Z"), durationMinutes: 30, stepMinutes: 30 });
  assert.deepEqual(slots.map((slot) => slot.toISOString()), ["2026-08-14T09:00:00.000Z", "2026-08-14T10:00:00.000Z", "2026-08-14T10:30:00.000Z"]);
});

test("assigns stable available resources without treating cancelled occupancy as a conflict", () => {
  const from = new Date("2026-08-14T09:00:00Z");
  const slots = findAvailableResourceSlots([
    { startsAt: from, endsAt: new Date("2026-08-14T09:30:00Z"), status: "scheduled", resourceIds: ["room-a"] },
    { startsAt: from, endsAt: new Date("2026-08-14T09:30:00Z"), status: "cancelled", resourceIds: ["room-b"] },
  ], [{ id: "room-a" }, { id: "room-b" }, { id: "room-c", active: false }], { from, to: new Date("2026-08-14T10:00:00Z"), durationMinutes: 30, stepMinutes: 30 });
  assert.deepEqual(slots.map((slot) => [slot.startsAt.toISOString(), slot.resourceIds]), [["2026-08-14T09:00:00.000Z", ["room-b"]], ["2026-08-14T09:30:00.000Z", ["room-a"]]]);
});

test("returns no resource assignment when the requested capacity is unavailable", () => {
  const from = new Date("2026-08-14T09:00:00Z");
  assert.deepEqual(findAvailableResourceSlots([{ startsAt: from, endsAt: new Date("2026-08-14T10:00:00Z"), status: "scheduled", resourceIds: ["room-a", "room-b"] }], [{ id: "room-a" }, { id: "room-b" }], { from, to: new Date("2026-08-14T10:00:00Z"), durationMinutes: 30, stepMinutes: 30 }, 2), []);
});
