import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "./server.js";

const booking = { id: "booking-1", tenantId: "tenant-1", customerId: "customer-1", serviceName: "Consultation", startsAt: new Date("2099-08-14T09:00:00Z"), endsAt: new Date("2099-08-14T09:30:00Z"), status: "scheduled", resourceIds: ["room-1"] as const };
const resolve = () => ({ identity: null, mappedUserId: null, membership: null, requestedTenantId: "tenant-1" });
test("reads and changes a public managed booking through opaque routes", async () => {
  let action = "";
  const app = createApiServer({ resolve, bookingManage: { read: async () => booking, reschedule: async (_token, startsAt, endsAt) => { action = "reschedule"; return { ...booking, startsAt, endsAt }; }, cancel: async () => { action = "cancel"; return { ...booking, status: "cancelled" }; } } });
  const read = await app.inject({ method: "GET", url: "/v1/public/manage/opaque-token" });
  assert.equal(read.statusCode, 200);
  assert.equal(read.json().data.resourceIds[0], "room-1");
  const moved = await app.inject({ method: "POST", url: "/v1/public/manage/opaque-token/reschedule", payload: { startsAt: "2099-08-14T10:00:00Z", endsAt: "2099-08-14T10:30:00Z", idempotencyKey: "move-1" } });
  assert.equal(moved.statusCode, 200);
  const cancelled = await app.inject({ method: "POST", url: "/v1/public/manage/opaque-token/cancel", payload: { idempotencyKey: "cancel-1" } });
  assert.equal(cancelled.statusCode, 200);
  assert.equal(action, "cancel");
  await app.close();
});
test("rejects malformed public manage requests", async () => {
  const app = createApiServer({ resolve, bookingManage: { read: async () => null, reschedule: async () => null, cancel: async () => null } });
  const response = await app.inject({ method: "POST", url: "/v1/public/manage/token/reschedule", payload: { startsAt: "not-a-date", endsAt: "not-a-date", idempotencyKey: "" } });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "MANAGE_INVALID");
  await app.close();
});
