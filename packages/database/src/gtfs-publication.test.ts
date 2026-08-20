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
import { executeGtfsPublicationCommand, GtfsPublicationCommandError } from "./gtfs-commands.js";

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
    if (sql.startsWith("INSERT INTO audit_events")) return [{ id: "audit-1" }] as T[];
    return [] as T[];
  } };
  const version = await recordGtfsValidation(executor, {
    tenantId: "tenant-1", feedVersionId: "feed-1",
    issues: [{ code: "unknown_stop", severity: "error", message: "Trip references an unknown stop" }],
  });
  assert.equal(version.status, "failed");
  assert.ok(statements.some((sql) => sql.startsWith("INSERT INTO gtfs_validation_issues")));
});

test("records immutable Schedule references with generation evidence", async () => {
  const statements: string[] = [];
  const executor = { query: async <T>(sql: string) => {
    statements.push(sql);
    if (sql.startsWith("UPDATE gtfs_feed_versions")) return [{ id: "feed-1", tenant_id: "tenant-1", version: "v1", status: "ready", valid_from: "2026-08-20", valid_until: "2026-12-31", schedule_sha256: "a".repeat(64), schedule_object_key: "gtfs/feed-1.zip", generated_at: new Date(), validated_at: new Date(), published_at: null }] as T[];
    if (sql.startsWith("INSERT INTO audit_events")) return [{ id: "audit-1" }] as T[];
    return [] as T[];
  } };
  await recordGtfsValidation(executor, { tenantId: "tenant-1", feedVersionId: "feed-1", issues: [], scheduleReferences: { scheduleVersion: "v1", routeIds: new Set(["route-1"]), tripIds: new Set(["trip-1"]), stopIds: new Set(["stop-1"]) } });
  assert.ok(statements.some((sql) => sql.startsWith("DELETE FROM gtfs_feed_version_entities")));
  assert.equal(statements.filter((sql) => sql.startsWith("INSERT INTO gtfs_feed_version_entities")).length, 3);
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

test("publication commands publish once and replay the same idempotent result", async () => {
  const row = { id: "feed-1", tenant_id: "tenant-1", version: "v1", status: "ready" as const, valid_from: "2026-08-20", valid_until: "2026-12-31", schedule_sha256: "a".repeat(64), schedule_object_key: "gtfs/v1.zip", generated_at: new Date(), validated_at: new Date(), published_at: null, created_at: new Date() };
  let completed = false; let updates = 0;
  const executor = { query: async <T>(sql: string) => {
    if (sql.startsWith("SELECT action")) return (completed ? [{ action: "publish", feed_version_id: "feed-1", result_version_id: "feed-1" }] : []) as T[];
    if (sql.startsWith("SELECT active_version_id")) return [{ active_version_id: null }] as T[];
    if (sql.includes("FOR UPDATE") && sql.includes("gtfs_feed_versions")) return [row] as T[];
    if (sql.startsWith("INSERT INTO gtfs_publication_commands")) return [{ idempotency_key: "cmd-1" }] as T[];
    if (sql.startsWith("UPDATE gtfs_feed_versions")) { updates += 1; return [] as T[]; }
    if (sql.startsWith("INSERT INTO audit_events")) return [{ id: "audit-1" }] as T[];
    if (sql.startsWith("SELECT id, tenant_id, version")) return [{ ...row, status: "published", published_at: new Date() }] as T[];
    if (sql.startsWith("UPDATE gtfs_feed_settings") || sql.startsWith("UPDATE gtfs_publication_commands")) { completed = true; return [] as T[]; }
    return [] as T[];
  } };
  const first = await executeGtfsPublicationCommand(executor, { tenantId: "tenant-1", feedVersionId: "feed-1", action: "publish", idempotencyKey: "cmd-1", actorId: "owner-1" });
  const second = await executeGtfsPublicationCommand(executor, { tenantId: "tenant-1", feedVersionId: "feed-1", action: "publish", idempotencyKey: "cmd-1", actorId: "owner-1" });
  assert.equal(first.status, "published"); assert.equal(second.id, "feed-1"); assert.equal(updates, 1);
});

test("validate command stays blocked until an artifact validator records evidence", async () => {
  const executor = { query: async <T>() => [] as T[] };
  await assert.rejects(() => executeGtfsPublicationCommand(executor, { tenantId: "tenant-1", feedVersionId: "feed-1", action: "validate", idempotencyKey: "cmd-validate", actorId: "owner-1" }), (error: unknown) => error instanceof GtfsPublicationCommandError && error.code === "GTFS_VALIDATION_REQUIRED");
});
