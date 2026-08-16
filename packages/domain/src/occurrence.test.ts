import assert from "node:assert/strict";
import test from "node:test";
import { isCapacityReserving, validateOccurrenceDraft, validateReservationDraft, validateReservationStatusChange } from "./occurrence.js";

const startsAt = new Date("2026-08-20T08:00:00Z");
const endsAt = new Date("2026-08-20T09:00:00Z");

test("accepts an unlimited occurrence for one-to-one service or charter use", () => {
  assert.deepEqual(validateOccurrenceDraft({ id: "o1", tenantId: "t1", serviceId: "service", label: "Charter journey", startsAt, endsAt, capacity: null }), []);
});

test("rejects malformed occurrence windows and capacities", () => {
  const errors = validateOccurrenceDraft({ id: "", tenantId: "t1", serviceId: "s", label: "", startsAt: endsAt, endsAt: startsAt, capacity: 0 });
  assert.equal(errors.length, 4);
});

test("enforces tenant, lifecycle, and shared occurrence capacity", () => {
  const occurrence = { tenantId: "t1", status: "open" as const, capacity: 10, reservedQuantity: 8 };
  assert.deepEqual(validateReservationDraft({ id: "r1", tenantId: "t1", occurrenceId: "o1", customerId: "c1", quantity: 2 }, occurrence), []);
  assert.match(validateReservationDraft({ id: "r2", tenantId: "t2", occurrenceId: "o1", customerId: "c1", quantity: 3 }, occurrence).join(";"), /tenant|capacity/iu);
});

test("only active reservation states consume capacity", () => {
  assert.equal(isCapacityReserving("held"), true);
  assert.equal(isCapacityReserving("confirmed"), true);
  assert.equal(isCapacityReserving("completed"), false);
  assert.equal(isCapacityReserving("cancelled"), false);
});

test("allows forward reservation lifecycle transitions and protects terminal records", () => {
  assert.deepEqual(validateReservationStatusChange("confirmed", "checked_in"), []);
  assert.deepEqual(validateReservationStatusChange("checked_in", "completed"), []);
  assert.match(validateReservationStatusChange("completed", "confirmed").join(";"), /cannot move/iu);
});
