// Ownership: stable ID and atomic GTFS publication persistence tests.

import assert from "node:assert/strict";
import test from "node:test";
import {
  publishGtfsFeedVersion,
  recordGtfsValidation,
  reserveGtfsPublicId,
  saveGtfsFeedSettings,
  readGtfsPublicSchedule,
} from "./gtfs-publication.js";

test("returns the first reserved public ID on later non-identity edits", async () => {
  const executor = { query: async <T>() => [{ public_id: "route-23" }] as T[] };
  const publicId = await reserveGtfsPublicId(executor, { tenantId: "tenant-1", entityKind: "route", internalId: "route-1", publicId: "renamed-route" });
  assert.equal(publicId, "route-23");
});

test("requires core feature and valid publisher settings", async () => {
  const executor = { query: async <T>() => [] as T[] };
  await assert.rejects(() => saveGtfsFeedSettings(executor, {
    tenantId: "tenant-1", publicSlug: "tenant-feed", publisherName: "Operator",
    publisherUrl: "https://example.com", defaultLanguage: "en", enabledFeatures: ["fares_v2"],
    schedulePublicationEnabled: false, realtimePublicationEnabled: false, activeVersionId: null,
  }), /core Schedule/iu);
});

test("failed validation cannot become ready", async () => {
  const statements: string[] = [];
  const executor = { query: async <T>(sql: string, parameters?: readonly unknown[]) => {
    statements.push(sql);
    if (sql.startsWith("UPDATE gtfs_feed_versions")) return [{
      id: "feed-1", tenant_id: "tenant-1", version: "v1", status: parameters?.[2],
      valid_from: "2026-08-19", valid_until: "2026-12-31", schedule_sha256: null,
      schedule_object_key: null, generated_at: new Date(), validated_at: new Date(), published_at: null,
    }] as T[];
    return [] as T[];
  } };
  const version = await recordGtfsValidation(executor, {
    tenantId: "tenant-1", feedVersionId: "feed-1",
    issues: [{ code: "unknown_stop", severity: "error", message: "Trip references an unknown stop" }],
  });
  assert.equal(version.status, "failed");
  assert.ok(statements.some((sql) => sql.startsWith("INSERT INTO gtfs_validation_issues")));
});

test("publishes only a validated artifact and records the previous version", async () => {
  const statements: string[] = [];
  const executor = { query: async <T>(sql: string) => {
    statements.push(sql);
    if (sql.startsWith("SELECT active_version_id")) return [{ active_version_id: "feed-old" }] as T[];
    if (sql.startsWith("UPDATE gtfs_feed_versions")) return [{
      id: "feed-new", tenant_id: "tenant-1", version: "v2", status: "published",
      valid_from: "2026-09-01", valid_until: "2027-01-01", schedule_sha256: "a".repeat(64),
      schedule_object_key: "gtfs/tenant-1/v2.zip", generated_at: new Date(), validated_at: new Date(), published_at: new Date(),
    }] as T[];
    if (sql.startsWith("INSERT INTO audit_events")) return [{ id: "audit-1" }] as T[];
    return [] as T[];
  } };
  const published = await publishGtfsFeedVersion(executor, { tenantId: "tenant-1", feedVersionId: "feed-new", actorId: "owner-1" });
  assert.equal(published.status, "published");
  assert.ok(statements.some((sql) => sql.startsWith("UPDATE gtfs_feed_settings SET active_version_id")));
  assert.ok(statements.some((sql) => sql.startsWith("INSERT INTO audit_events")));
});

test("public schedule lookup returns only the active published artifact metadata", async () => {
  const executor = { query: async <T>(sql: string) => sql.startsWith("SELECT settings") ? [{ tenant_id: "tenant-1", public_slug: "city-feed", version: "v2", schedule_object_key: "gtfs/v2.zip", schedule_sha256: "b".repeat(64), published_at: new Date("2026-08-20T08:00:00Z") }] as T[] : [] as T[] };
  const result = await readGtfsPublicSchedule(executor, "city-feed");
  assert.deepEqual(result, { tenantId: "tenant-1", publicSlug: "city-feed", version: "v2", objectKey: "gtfs/v2.zip", sha256: "b".repeat(64), publishedAt: new Date("2026-08-20T08:00:00Z") });
});
