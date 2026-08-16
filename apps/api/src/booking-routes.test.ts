import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "./server.js";

const identity = { issuer: "https://novaauth.niuautomations.com", subject: "sub-1" };
const membership = { userId: "user-1", tenantId: "tenant-1", branchIds: ["branch-1"], role: "owner" as const, status: "active" as const };
const destination = { publicCode: "branch-booking-code-01", tenantId: "tenant-1", branchId: null, packId: "dental", serviceId: "consultation", campaign: null, status: "active" as const, expiresAt: null };

test("lists, creates, and status-mutates tenant bookings", async () => {
  const booking = { id: "booking-1", tenantId: "tenant-1", customerId: "customer-1", serviceName: "Consultation", startsAt: new Date("2026-08-14T09:00:00Z"), endsAt: new Date("2026-08-14T09:30:00Z"), status: "scheduled" as const };
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), bookingAdmin: { list: async () => [booking], create: async (input) => ({ ...booking, ...input }), setStatus: async (_tenantId, _bookingId, status) => ({ ...booking, status }) } });
  assert.equal((await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/bookings" })).statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/bookings", payload: { customerId: "customer-1", serviceName: "Consultation", startsAt: "2026-08-14T09:00:00Z", endsAt: "2026-08-14T09:30:00Z" } })).statusCode, 201);
  assert.equal((await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/bookings/booking-1/status", payload: { status: "completed" } })).statusCode, 200);
  await app.close();
});

test("requires a live QR destination for public hold and confirmation", async () => {
  let receivedContact = false;
  let receivedAssignments: readonly { requirementId: string; resourceIds: readonly string[] }[] = [];
  let receivedResources: readonly string[] = [];
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), qrReader: { findByPublicCode: async () => destination }, bookingPublic: { createHold: async (input) => { receivedResources = input.resourceIds ?? []; receivedAssignments = input.requirementAssignments ?? []; return { holdId: "hold-1", holdToken: "opaque-token", serviceName: input.serviceName, startsAt: input.startsAt, endsAt: input.endsAt, expiresAt: new Date("2026-08-14T08:10:00Z"), ...(input.resourceIds ? { resourceIds: input.resourceIds } : {}) }; }, confirmHold: async (input) => { receivedContact = input.contact?.channel === "email" && input.contact.consentGranted; return { id: "booking-1", tenantId: "tenant-1", customerId: "customer-1", serviceName: "Consultation", startsAt: new Date("2026-08-14T09:00:00Z"), endsAt: new Date("2026-08-14T09:30:00Z"), status: "scheduled" }; } } });
  const hold = await app.inject({ method: "POST", url: "/v1/public/qr/branch-booking-code-01/booking-holds", payload: { customerName: "Alex", serviceName: "Consultation", startsAt: "2026-08-14T09:00:00Z", endsAt: "2026-08-14T09:30:00Z", idempotencyKey: "request-1", resourceIds: ["room-1"], requirementAssignments: [{ requirementId: "chair", resourceIds: ["room-1"] }] } });
  assert.equal(hold.statusCode, 201);
  assert.equal(hold.json().data.holdToken, "opaque-token");
  assert.deepEqual(receivedResources, ["room-1"]);
  assert.deepEqual(receivedAssignments, [{ requirementId: "chair", resourceIds: ["room-1"] }]);
  const confirmed = await app.inject({ method: "POST", url: "/v1/public/qr/branch-booking-code-01/booking-holds/hold-1/confirm", payload: { holdToken: "opaque-token", idempotencyKey: "confirm-1", contact: { channel: "email", destination: "alex@example.test", consentGranted: true } } });
  assert.equal(confirmed.statusCode, 201);
  assert.equal(receivedContact, true);
  await app.close();
});
test("maps a resource allocation conflict during public confirmation", async () => {
  const app = createApiServer({ resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }), qrReader: { findByPublicCode: async () => destination }, bookingPublic: { createHold: async () => { throw new Error("resource allocation conflict"); }, confirmHold: async () => { throw new Error("resource allocation conflict"); } } });
  const response = await app.inject({ method: "POST", url: "/v1/public/qr/branch-booking-code-01/booking-holds/hold-1/confirm", payload: { holdToken: "opaque-token", idempotencyKey: "confirm-1" } });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "BOOKING_INVALID");
  await app.close();
});
