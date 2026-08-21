// Ownership: GTFS publication authorization and redaction contract tests.

import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "./server.js";

const identity = { issuer: "https://auth.example", subject: "user-1" };
const membership = { userId: "user-1", tenantId: "tenant-1", role: "manager" as const, branchIds: ["branch-1"], status: "active" as const };
const context = () => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: "tenant-1" });
const version = { id: "feed-1", tenantId: "tenant-1", version: "2026.08.20.1", status: "ready" as const, createdAt: new Date("2026-08-20T08:00:00Z"), validFrom: "2026-08-20", validUntil: "2026-12-31", scheduleSha256: "a".repeat(64), scheduleObjectKey: "gtfs/feed-1.zip", generatedAt: new Date("2026-08-20T08:01:00Z"), validatedAt: new Date("2026-08-20T08:02:00Z"), publishedAt: null };

test("admitted manager receives a privacy-safe GTFS publication status", async () => {
  const app = createApiServer({ resolve: context, gtfsPublication: { readStatus: async () => ({ settings: { tenantId: "tenant-1", publicSlug: "city-feed", publisherName: "Niu Transit", publisherUrl: "https://example.com", defaultLanguage: "en", enabledFeatures: ["core", "frequencies"], schedulePublicationEnabled: false, realtimePublicationEnabled: false, activeVersionId: null }, activeVersion: null, latestVersion: version, versions: [version], issueCounts: { "feed-1": { error: 0, warning: 1, info: 0 } }, lastRealtimeObservationAt: null }), readValidation: async () => [] } });
  const response = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/gtfs/publication" });
  assert.equal(response.statusCode, 200); assert.equal(response.json().data.organizationId, "tenant-1"); assert.equal(response.json().data.latestCandidate.issueCounts.warning, 1); assert.equal(response.json().data.publicScheduleUrl, null); assert.equal(response.json().data.lastRealtimeObservationAt, null); assert.equal(response.json().data.realtimeState, "disabled");
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

test("public Schedule delivery is immutable, cacheable, and privacy-safe", async () => {
  const app = createApiServer({ resolve: context, gtfsPublication: {
    readStatus: async () => null, readValidation: async () => [],
    readPublicSchedule: async (publicSlug) => publicSlug === "city-feed" ? { tenantId: "tenant-1", publicSlug, version: "2026.08.20.1", objectKey: "gtfs/feed-1.zip", sha256: "a".repeat(64), publishedAt: new Date("2026-08-20T08:02:00Z") } : null,
    artifactStore: { read: async (objectKey) => objectKey === "gtfs/feed-1.zip" ? Uint8Array.from([80, 75, 3, 4, 1]) : null, write: async () => undefined },
  } });
  const response = await app.inject({ method: "GET", url: "/v1/public/gtfs/city-feed/schedule.zip" });
  assert.equal(response.statusCode, 200); assert.equal(response.headers.etag, `"${"a".repeat(64)}"`); assert.equal(response.headers["cache-control"], "public, max-age=300, stale-while-revalidate=60"); assert.equal(response.headers["x-powered-by"], undefined); assert.deepEqual([...response.rawPayload], [80, 75, 3, 4, 1]);
  const cached = await app.inject({ method: "GET", url: "/v1/public/gtfs/city-feed/schedule.zip", headers: { "if-none-match": `"${"a".repeat(64)}"` } }); assert.equal(cached.statusCode, 304);
  assert.equal((await app.inject({ method: "GET", url: "/v1/public/gtfs/missing/schedule.zip" })).statusCode, 404);
  await app.close();
});

test("publication commands require owner/admin scope and preserve idempotency keys", async () => {
  let received: unknown;
  const app = createApiServer({ resolve: () => ({ ...context(), membership: { ...membership, role: "owner" as const } }), gtfsPublication: {
    readStatus: async () => ({ settings: { tenantId: "tenant-1", publicSlug: "city-feed", publisherName: "Niu Transit", publisherUrl: "https://example.com", defaultLanguage: "en", enabledFeatures: ["core"], schedulePublicationEnabled: true, realtimePublicationEnabled: false, activeVersionId: "feed-1" }, activeVersion: version, latestVersion: version, versions: [version], issueCounts: { "feed-1": { error: 0, warning: 0, info: 0 } }, lastRealtimeObservationAt: null }),
    readValidation: async () => [], command: async (input) => { received = input; return { ...version, status: "published" as const, publishedAt: new Date("2026-08-20T08:02:00Z") }; },
  } });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/gtfs/commands", payload: { feedVersionId: "feed-1", action: "publish", idempotencyKey: "cmd-1" } });
  assert.equal(response.statusCode, 200); assert.equal(response.json().data.feedVersion.lifecycle, "published"); assert.equal((received as { idempotencyKey: string }).idempotencyKey, "cmd-1");
  const denied = createApiServer({ resolve: context, gtfsPublication: { readStatus: async () => null, readValidation: async () => [], command: async () => version } });
  assert.equal((await denied.inject({ method: "POST", url: "/v1/tenants/tenant-1/gtfs/commands", payload: { feedVersionId: "feed-1", action: "publish", idempotencyKey: "cmd-2" } })).statusCode, 403);
  await app.close(); await denied.close();
});

test("owner can generate a validated Schedule artifact before publishing", async () => {
  let savedKey = "";
  const files = [
    { fileName: "agency.txt", content: "agency_id,agency_name,agency_url,agency_timezone\na,Agency,https://example.test,Africa/Nairobi\n" },
    { fileName: "stops.txt", content: "stop_id,stop_name,stop_lat,stop_lon\ns1,One,0,0\ns2,Two,0,1\n" },
    { fileName: "routes.txt", content: "route_id,agency_id,route_type\nr1,a,3\n" },
    { fileName: "trips.txt", content: "route_id,service_id,trip_id\nr1,svc,t1\n" },
    { fileName: "stop_times.txt", content: "trip_id,arrival_time,departure_time,stop_id,stop_sequence\nt1,08:00:00,08:00:00,s1,1\nt1,08:10:00,08:10:00,s2,2\n" },
    { fileName: "calendar_dates.txt", content: "service_id,date,exception_type\nsvc,20260820,1\n" },
  ] as const;
  const app = createApiServer({ resolve: () => ({ ...context(), membership: { ...membership, role: "owner" as const } }), gtfsPublication: {
    readStatus: async () => null, readValidation: async () => [], readScheduleFiles: async () => files,
    recordValidation: async ({ scheduleSha256, scheduleObjectKey }) => { savedKey = scheduleObjectKey ?? ""; return { ...version, status: "ready" as const, scheduleSha256: scheduleSha256 ?? null, scheduleObjectKey: scheduleObjectKey ?? null }; },
    artifactStore: { read: async () => null, write: async (key) => { savedKey = key; } },
  } });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/gtfs/versions/feed-1/generate" });
  assert.equal(response.statusCode, 200); assert.equal(response.json().data.feedVersion.lifecycle, "ready"); assert.match(savedKey, /^gtfs\/[a-f0-9]{64}\.zip$/u);
  await app.close();
});

test("public VehiclePositions delivery uses protobuf and omits private telemetry identifiers", async () => {
  const app = createApiServer({ resolve: context, gtfsPublication: {
    readStatus: async () => null, readValidation: async () => [],
    readPublicVehiclePositions: async (slug) => slug === "city-feed" ? {
      scheduleVersion: "2026.08.20.1", generatedAt: new Date("2026-08-20T08:02:00Z"),
      entities: [{ entityPublicId: "vp-vehicle-1", vehiclePublicId: "vehicle-1", trip: { tripPublicId: "trip-1", routePublicId: "route-1", startDate: "20260820", scheduleRelationship: "scheduled" as const }, latitude: -1.28, longitude: 36.82, capturedAt: new Date("2026-08-20T08:01:45Z") }],
    } : null,
  } });
  const response = await app.inject({ method: "GET", url: "/v1/public/gtfs/city-feed/vehicle-positions.pb" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/x-protobuf");
  assert.equal(response.headers["x-gtfs-schedule-version"], "2026.08.20.1");
  assert.equal(response.rawPayload.includes(Buffer.from("driver-1")), false);
  assert.equal((await app.inject({ method: "GET", url: "/v1/public/gtfs/missing/vehicle-positions.pb" })).statusCode, 404);
  await app.close();
});

test("public VehiclePositions prefers a fresh worker cache and exposes its validators", async () => {
  const app = createApiServer({ resolve: context, gtfsPublication: {
    readStatus: async () => null, readValidation: async () => [],
    readCachedVehiclePositions: async () => ({ scheduleVersion: "2026.08.20.1", payload: Uint8Array.from([1, 2, 3]), sha256: "b".repeat(64), generatedAt: new Date("2026-08-20T08:02:00Z") }),
    readPublicVehiclePositions: async () => { throw new Error("live fallback should not run"); },
  } });
  const response = await app.inject({ method: "GET", url: "/v1/public/gtfs/city-feed/vehicle-positions.pb" });
  assert.equal(response.statusCode, 200); assert.equal(response.headers.etag, `"${"b".repeat(64)}"`); assert.equal(response.headers["last-modified"], "Thu, 20 Aug 2026 08:02:00 GMT"); assert.deepEqual([...response.rawPayload], [1, 2, 3]);
  await app.close();
});

test("TripUpdates delivery is protobuf, cacheable, and fail-closed when not composed", async () => {
  const app = createApiServer({ resolve: context, gtfsPublication: {
    readStatus: async () => null, readValidation: async () => [],
    readPublicTripUpdates: async (slug) => slug === "city-feed" ? { scheduleVersion: "2026.08.20.1", generatedAt: new Date("2026-08-20T08:02:00Z"), entities: [] } : null,
  } });
  const response = await app.inject({ method: "GET", url: "/v1/public/gtfs/city-feed/trip-updates.pb" });
  assert.equal(response.statusCode, 200); assert.equal(response.headers["content-type"], "application/x-protobuf"); assert.equal(response.headers["x-gtfs-schedule-version"], "2026.08.20.1");
  assert.equal((await app.inject({ method: "GET", url: "/v1/public/gtfs/missing/trip-updates.pb" })).statusCode, 404); await app.close();
});

test("Alerts delivery is protobuf and fail-closed when no alert source is composed", async () => {
  const app = createApiServer({ resolve: context, gtfsPublication: { readStatus: async () => null, readValidation: async () => [] } });
  const unavailable = await app.inject({ method: "GET", url: "/v1/public/gtfs/city-feed/alerts.pb" });
  assert.equal(unavailable.statusCode, 503);
  await app.close();
});
