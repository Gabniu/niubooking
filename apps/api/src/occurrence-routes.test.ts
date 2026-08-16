// Ownership: API proof for tenant-scoped occurrence and reservation journeys.

import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "./server.js";

const identity = { issuer: "https://novaauth.niuautomations.com", subject: "sub-1" };
const membership = { userId: "user-1", tenantId: "tenant-1", branchIds: [], role: "owner" as const, status: "active" as const };
const occurrence = { id: "o1", tenantId: "tenant-1", serviceId: "s1", label: "Morning class", startsAt: new Date("2026-08-20T08:00:00Z"), endsAt: new Date("2026-08-20T09:00:00Z"), status: "open" as const, capacity: 12, reservedQuantity: 3 };
const destination = { publicCode: "qr-occurrence-code-1", tenantId: "tenant-1", branchId: null, packId: "fitness", serviceId: "s1", campaign: null, status: "active" as const, expiresAt: null };

function dependencies() {
  return {
    resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" }),
    qrReader: { findByPublicCode: async () => destination },
    occurrenceAdmin: {
      list: async () => [occurrence],
      create: async (input: unknown) => ({ ...occurrence, ...(input as object) }),
      reserve: async (input: unknown) => ({ id: "r1", ...(input as object), status: "confirmed" as const }),
      listReservations: async () => [{ id: "r1", tenantId: "tenant-1", occurrenceId: "o1", customerId: "c1", quantity: 1, status: "confirmed" as const }],
      setReservationStatus: async (input: { status: import("@bookingapp/domain").ReservationStatus; actorId?: string }) => { assert.equal(input.actorId, "user-1"); return { id: "r1", tenantId: "tenant-1", occurrenceId: "o1", customerId: "c1", quantity: 1, status: input.status }; },
      reservePublic: async (input: { tenantId: string; occurrenceId: string; quantity: number }) => ({ id: "public-r1", tenantId: input.tenantId, occurrenceId: input.occurrenceId, customerId: "internal", quantity: input.quantity, status: "confirmed" as const }),
      discover: async () => [occurrence],
    },
  };
}

test("lists and creates occurrences through the authorized API", async () => {
  const app = createApiServer(dependencies());
  const listed = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/occurrences" });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().data[0].startsAt, "2026-08-20T08:00:00.000Z");
  const created = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/occurrences", payload: { serviceId: "s1", label: "Morning class", startsAt: occurrence.startsAt.toISOString(), endsAt: occurrence.endsAt.toISOString(), capacity: 12 } });
  assert.equal(created.statusCode, 201);
  await app.close();
});

test("creates a reservation and rejects malformed quantity", async () => {
  const app = createApiServer(dependencies());
  const invalid = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/occurrences/o1/reservations", payload: { customerId: "c1", quantity: 0 } });
  assert.equal(invalid.statusCode, 400);
  const accepted = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/occurrences/o1/reservations", payload: { customerId: "c1", quantity: 2 } });
  assert.equal(accepted.statusCode, 201);
  assert.equal(accepted.json().data.occurrenceId, "o1");
  await app.close();
});

test("lists and updates staff reservation lifecycle state", async () => {
  const app = createApiServer(dependencies());
  const listed = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/occurrences/o1/reservations" });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().data[0].status, "confirmed");
  const changed = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/occurrences/o1/reservations/r1/status", payload: { status: "cancelled" } });
  assert.equal(changed.statusCode, 200);
  assert.equal(changed.json().data.status, "cancelled");
  await app.close();
});

test("does not expose occurrence data across tenants", async () => {
  const app = createApiServer({ ...dependencies(), resolve: () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "other-tenant" }) });
  const response = await app.inject({ method: "GET", url: "/v1/tenants/tenant-2/occurrences" });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().data, null);
  await app.close();
});

test("public QR discovery only returns an active destination's publishable occurrences", async () => {
  const app = createApiServer(dependencies());
  const response = await app.inject({ method: "GET", url: "/v1/public/qr/qr-occurrence-code-1/occurrences" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data[0], { id: "o1", serviceId: "s1", label: "Morning class", startsAt: "2026-08-20T08:00:00.000Z", endsAt: "2026-08-20T09:00:00.000Z", capacity: 12, remainingCapacity: 9 });
  await app.close();
});

test("public QR reservation validates consent and returns no internal customer identity", async () => {
  const app = createApiServer(dependencies());
  const invalid = await app.inject({ method: "POST", url: "/v1/public/qr/qr-occurrence-code-1/occurrences/o1/reservations", payload: { customerName: "Alex", quantity: 1, idempotencyKey: "short" } });
  assert.equal(invalid.statusCode, 400);
  const accepted = await app.inject({ method: "POST", url: "/v1/public/qr/qr-occurrence-code-1/occurrences/o1/reservations", payload: { customerName: "Alex", quantity: 2, idempotencyKey: "public-request-1", contact: { channel: "email", destination: "alex@example.com", consentGranted: true } } });
  assert.equal(accepted.statusCode, 201);
  assert.deepEqual(accepted.json().data, { reservationId: "public-r1", occurrenceId: "o1", quantity: 2, status: "confirmed" });
  assert.equal("customerId" in accepted.json().data, false);
  await app.close();
});
