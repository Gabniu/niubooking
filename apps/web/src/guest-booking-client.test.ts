import assert from "node:assert/strict";
import test from "node:test";
import { cancelManagedBooking, confirmGuestHold, createGuestHold, createGuestOccurrenceReservation, fetchGuestAvailability, fetchGuestDestination, fetchGuestOccurrences, fetchGuestRequirementAvailability, fetchManagedBooking, formatRequirementAssignmentSummary, formatRequirementAvailabilityMessage, rescheduleManagedBooking, shouldFallbackToLegacyAvailability } from "./guest-booking-client.js";

const destination = { publicCode: "branch-booking-code-01", tenantId: "tenant-1", branchId: null, packId: "dental", serviceId: "consultation", campaign: null };
const hold = { holdId: "hold-1", holdToken: "opaque-token", serviceName: "Consultation", startsAt: "2026-08-14T09:00:00.000Z", endsAt: "2026-08-14T09:30:00.000Z", expiresAt: "2026-08-14T08:10:00.000Z" };
test("loads a QR destination and creates an opaque hold", async () => {
  const state = await fetchGuestDestination(async (url) => { assert.match(url, /public\/qr/); return { ok: true, status: 200, json: async () => ({ data: destination, error: null }) }; }, "", destination.publicCode);
  assert.equal(state.kind, "ready");
  const created = await createGuestHold(async (_url, init) => { assert.equal(init?.method, "POST"); assert.match(init?.body ?? "", /room-1/); return { ok: true, status: 201, json: async () => ({ data: hold, error: null }) }; }, "", destination.publicCode, { customerName: "Alex", serviceName: "Consultation", startsAt: hold.startsAt, endsAt: hold.endsAt, idempotencyKey: "request-1", resourceIds: ["room-1"] });
  assert.equal(created.kind, "ready");
  assert.equal(created.value.holdToken, "opaque-token");
});
test("confirms a held booking and maps an expired hold", async () => {
  const confirmed = await confirmGuestHold(async () => ({ ok: true, status: 201, json: async () => ({ data: { id: "booking-1", tenantId: "tenant-1", customerId: "customer-1", serviceName: "Consultation", startsAt: hold.startsAt, endsAt: hold.endsAt, status: "scheduled" }, error: null }) }), "", destination.publicCode, hold.holdId, hold.holdToken, "confirm-1");
  assert.equal(confirmed.kind, "ready");
  const expired = await confirmGuestHold(async () => ({ ok: false, status: 409, json: async () => ({ data: null, error: { code: "BOOKING_HOLD_EXPIRED", message: "Expired" } }) }), "", destination.publicCode, hold.holdId, hold.holdToken, "confirm-2");
  assert.equal(expired.kind, "error");
});
test("loads public advisory availability for a QR destination", async () => {
  const state = await fetchGuestAvailability(async (url) => { assert.match(url, /availability\?/); return { ok: true, status: 200, json: async () => ({ data: [{ startsAt: hold.startsAt, endsAt: hold.endsAt, resourceIds: ["room-1"] }], error: null }) }; }, "", destination.publicCode, { from: hold.startsAt, to: "2026-08-14T10:00:00.000Z", durationMinutes: 30 });
  assert.equal(state.kind, "ready");
  assert.equal(state.value[0]?.resourceIds[0], "room-1");
});
test("loads requirement-aware public advisory availability", async () => {
  const state = await fetchGuestRequirementAvailability(async (url) => { assert.match(url, /requirement-availability\?/); return { ok: true, status: 200, json: async () => ({ data: { slots: [{ startsAt: hold.startsAt, endsAt: hold.endsAt, assignments: [{ requirementId: "vehicle", resourceIds: ["car-1"] }] }], rejected: [] }, error: null }) }; }, "", destination.publicCode, { from: hold.startsAt, to: "2026-08-14T10:00:00.000Z", durationMinutes: 30 });
  assert.equal(state.kind, "ready");
  assert.equal(state.value.slots[0]?.assignments[0]?.resourceIds[0], "car-1");
});
test("falls back to legacy availability only when no requirements are configured", () => {
  assert.equal(shouldFallbackToLegacyAvailability({ slots: [], rejected: [] }), true);
  assert.equal(shouldFallbackToLegacyAvailability({ slots: [], rejected: [{ requirementId: "vehicle", reason: "INSUFFICIENT_RESOURCES" }] }), false);
});
test("translates resource rejection codes into customer-safe guidance", () => {
  assert.match(formatRequirementAvailabilityMessage({ slots: [], rejected: [{ requirementId: "vehicle", reason: "INSUFFICIENT_RESOURCES" }] }), /already full/);
  assert.match(formatRequirementAvailabilityMessage({ slots: [], rejected: [{ requirementId: "chair", reason: "NO_COMPATIBLE_RESOURCES" }] }), /not available at this time/);
});
test("summarizes matched requirements without exposing resource identifiers", () => { assert.equal(formatRequirementAssignmentSummary([{ requirementId: "instructor", requirementLabel: "Instructor", resourceIds: ["opaque-1"] }, { requirementId: "vehicle", requirementLabel: "Vehicle", resourceIds: ["opaque-2"] }]), "This time includes Instructor, Vehicle."); assert.equal(formatRequirementAssignmentSummary([{ requirementId: "resource", resourceIds: ["opaque-1"] }]), "This time includes all required resources."); });
test("loads only publishable public occurrences from a QR destination", async () => {
  const state = await fetchGuestOccurrences(async (url) => { assert.match(url, /occurrences$/); return { ok: true, status: 200, json: async () => ({ data: [{ id: "o1", serviceId: "consultation", label: "Morning consultation", startsAt: hold.startsAt, endsAt: hold.endsAt, capacity: 1, remainingCapacity: 1 }], error: null }) }; }, "", destination.publicCode);
  assert.equal(state.kind, "ready");
  assert.equal(state.value[0]?.id, "o1");
});
test("creates a public occurrence reservation with a retry key", async () => {
  const state = await createGuestOccurrenceReservation(async (url, init) => { assert.match(url, /occurrences\/o1\/reservations$/); assert.equal(init?.method, "POST"); assert.match(init?.body ?? "", /public-request-1/); return { ok: true, status: 201, json: async () => ({ data: { reservationId: "r1", occurrenceId: "o1", quantity: 1, status: "confirmed" }, error: null }) }; }, "", destination.publicCode, "o1", { customerName: "Alex", quantity: 1, idempotencyKey: "public-request-1" });
  assert.equal(state.kind, "ready");
  assert.equal(state.value.reservationId, "r1");
});
test("loads and changes a public managed booking", async () => {
  const response = async (_url: string, init?: { method?: "POST" }) => ({ ok: true, status: 200, json: async () => ({ data: { id: "booking-1", tenantId: "tenant-1", customerId: "customer-1", serviceName: "Consultation", startsAt: hold.startsAt, endsAt: hold.endsAt, status: "scheduled" }, error: null }) });
  assert.equal((await fetchManagedBooking(response, "", "opaque-token")).kind, "ready");
  assert.equal((await rescheduleManagedBooking(response, "", "opaque-token", { startsAt: hold.startsAt, endsAt: hold.endsAt, idempotencyKey: "move-1" })).kind, "ready");
  assert.equal((await cancelManagedBooking(response, "", "opaque-token", "cancel-1")).kind, "ready");
});
