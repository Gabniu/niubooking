// Ownership: tenant-scoped alert authoring and Schedule-reference tests.

import assert from "node:assert/strict";
import test from "node:test";
import { createGtfsAlert, setGtfsAlertStatus } from "./gtfs-alerts.js";

test("creates an alert only against the active published Schedule", async () => {
  const statements: string[] = [];
  const executor = { async query<T>(sql: string): Promise<T[]> { statements.push(sql); if (sql.includes("SELECT version.id")) return [{ feed_version_id: "version-1", version: "feed-1" }] as T[]; if (sql.includes("gtfs_feed_version_entities")) return [{ entity_kind: "route", public_id: "route-1" }] as T[]; if (sql.startsWith("INSERT INTO gtfs_realtime_alerts")) return [{ id: "alert-created", tenant_id: "tenant-1", feed_version_id: "version-1", header_text: "Road closed", description_text: null, active_from: null, active_until: null, route_public_ids: ["route-1"], stop_public_ids: [], trip_public_ids: [], status: "draft", created_at: new Date("2026-08-21T10:00:00Z") }] as T[]; return [] as T[]; } };
  const alert = await createGtfsAlert(executor, { tenantId: "tenant-1", headerText: "Road closed", routePublicIds: ["route-1"] });
  assert.equal(alert.feedVersionId, "version-1"); assert.equal(alert.status, "draft"); assert.ok(statements.some((sql) => sql.startsWith("INSERT INTO gtfs_realtime_alerts")));
});

test("changes only the tenant-owned alert lifecycle", async () => {
  const executor = { async query<T>(sql: string): Promise<T[]> { return sql.startsWith("UPDATE gtfs_realtime_alerts") ? [{ id: "alert-1", tenant_id: "tenant-1", feed_version_id: "version-1", header_text: "Road closed", description_text: null, active_from: null, active_until: null, route_public_ids: [], stop_public_ids: [], trip_public_ids: [], status: "published", created_at: new Date() }] as T[] : [] as T[]; } };
  const alert = await setGtfsAlertStatus(executor, { tenantId: "tenant-1", alertId: "alert-1", status: "published" });
  assert.equal(alert?.status, "published");
});
