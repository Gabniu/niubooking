import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "./server.js";

const resolve = () => ({ identity: { issuer: "test", subject: "user-1" }, mappedUserId: "user-1", membership: { userId: "user-1", tenantId: "tenant-1", branchIds: [], role: "manager", status: "active" as const }, requestedTenantId: "tenant-1" });
test("returns explainable requirement-aware advisory slots", async () => {
  const app = createApiServer({ resolve, requirementAvailabilityAdmin: { find: async () => ({ slots: [{ startsAt: new Date("2026-08-14T09:00:00Z"), endsAt: new Date("2026-08-14T10:00:00Z"), assignments: [{ requirementId: "vehicle", resourceIds: ["car-1"] }] }], rejected: [] }) } });
  const response = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/services/service-1/requirement-availability?from=2026-08-14T09:00:00Z&to=2026-08-14T10:00:00Z&durationMinutes=60&stepMinutes=30" });
  assert.equal(response.statusCode, 200); assert.match(response.body, /car-1/iu); await app.close();
});
test("serves requirement-aware candidates through an active public QR destination", async () => {
  const app = createApiServer({ resolve, qrReader: { findByPublicCode: async () => ({ publicCode: "code-1234567890123456", tenantId: "tenant-1", branchId: null, packId: null, serviceId: "service-1", campaign: null, status: "active", expiresAt: null }) }, requirementAvailabilityAdmin: { find: async () => ({ slots: [], rejected: [] }) } });
  const response = await app.inject({ method: "GET", url: "/v1/public/qr/code-1234567890123456/requirement-availability?from=2026-08-14T09:00:00Z&to=2026-08-14T10:00:00Z&durationMinutes=60&stepMinutes=30" });
  assert.equal(response.statusCode, 200); await app.close();
});
