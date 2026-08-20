// Ownership: GTFS publication authorization and redaction contract tests.

import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "./server.js";

const identity = { issuer: "https://auth.example", subject: "user-1" };
const membership = { userId: "user-1", tenantId: "tenant-1", role: "manager" as const, branchIds: ["branch-1"], status: "active" as const };
const context = () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" });
const version = { id: "feed-1", tenantId: "tenant-1", version: "2026.08.20.1", status: "ready" as const, createdAt: new Date("2026-08-20T08:00:00Z"), validFrom: "2026-08-20", validUntil: "2026-12-31", scheduleSha256: "a".repeat(64), scheduleObjectKey: "gtfs/feed-1.zip", generatedAt: new Date("2026-08-20T08:01:00Z"), validatedAt: new Date("2026-08-20T08:02:00Z"), publishedAt: null };

test("admitted manager receives a privacy-safe GTFS publication status", async () => {
  const app = createApiServer({ resolve: context, gtfsPublication: { readStatus: async () => ({ settings: { tenantId: "tenant-1", publicSlug: "city-feed", publisherName: "Niu Transit", publisherUrl: "https://example.com", defaultLanguage: "en", enabledFeatures: ["core", "frequencies"], schedulePublicationEnabled: false, realtimePublicationEnabled: false, activeVersionId: null }, activeVersion: null, latestVersion: version, issueCounts: { "feed-1": { error: 0, warning: 1, info: 0 } } }), readValidation: async () => [] } });
  const response = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/gtfs/publication" });
  assert.equal(response.statusCode, 200); assert.equal(response.json().data.organizationId, "tenant-1"); assert.equal(response.json().data.latestCandidate.issueCounts.warning, 1); assert.equal(response.json().data.publicScheduleUrl, null);
  await app.close();
});

test("validation route reports blocking issues and denies drivers", async () => {
  const app = createApiServer({ resolve: context, gtfsPublication: { readStatus: async () => null, readValidation: async () => [{ code: "unknown_stop", severity: "error", fileName: "stop_times.txt", entityPublicId: "trip-1", message: "Trip references an unknown stop", suggestedAction: "Choose a published stop." }] } });
  const report = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/gtfs/versions/feed-1/validation" });
  assert.equal(report.statusCode, 200); assert.equal(report.json().data.canPublish, false); assert.equal(report.json().data.issues[0].file, "stop_times.txt");
  const denied = createApiServer({ resolve: () => ({ ...context(), membership: { ...membership, role: "driver" as const } }), gtfsPublication: { readStatus: async () => null, readValidation: async () => [] } });
  assert.equal((await denied.inject({ method: "GET", url: "/v1/tenants/tenant-1/gtfs/publication" })).statusCode, 403);
  await app.close(); await denied.close();
});
