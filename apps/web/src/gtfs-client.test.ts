// Ownership: GTFS client contract mapping tests.

import assert from "node:assert/strict";
import test from "node:test";
import { createGtfsAlert, executeGtfsCommand, fetchGtfsAlerts, fetchGtfsPublication, fetchGtfsValidation, generateGtfsArtifact, setGtfsAlertStatus } from "./gtfs-client.js";

const status = { organizationId: "tenant-1", publicScheduleUrl: null, publicVehiclePositionsUrl: null, publicTripUpdatesUrl: null, publicAlertsUrl: null, activeSchedule: null, latestCandidate: null, versions: [], features: [], lastRealtimeObservationAt: null, realtimeState: "disabled" as const };

test("loads typed GTFS publication status with encoded tenant", async () => {
  let url = "";
  const result = await fetchGtfsPublication(async (input) => { url = input; return { status: 200, json: async () => ({ data: status, error: null }) }; }, "https://api.example", "tenant/one");
  assert.equal(result.kind, "ready"); assert.equal(url, "https://api.example/v1/tenants/tenant%2Fone/gtfs/publication");
});

test("maps validation denial to safe copy", async () => {
  const result = await fetchGtfsValidation(async () => ({ status: 403, json: async () => ({ data: null, error: { code: "GTFS_ACCESS_DENIED", message: "internal" } }) }), "", "tenant-1", "feed-1");
  assert.deepEqual(result, { kind: "denied", message: "You do not have access to transit publication settings." });
});

test("posts an idempotent publication command through the typed client", async () => {
  let init: { method?: string; body?: string } | undefined;
  const state = await executeGtfsCommand(async (_url, options) => { init = options; return { status: 200, json: async () => ({ data: { feedVersion: { id: "feed-1", version: "v1", lifecycle: "published", createdAt: "2026-08-20T08:00:00Z", validatedAt: null, publishedAt: "2026-08-20T08:01:00Z", validFrom: "2026-08-20", validUntil: "2026-12-31", issueCounts: { error: 0, warning: 0, info: 0 } } }, error: null }) }; }, "", "tenant/1", { feedVersionId: "feed-1", action: "publish", idempotencyKey: "cmd-1" });
  assert.equal(state.kind, "ready"); assert.equal(init?.method, "POST"); assert.match(init?.body ?? "", /cmd-1/iu);
});

test("generates a Schedule artifact through the typed client", async () => {
  let url = "";
  const state = await generateGtfsArtifact(async (input, options) => { url = input; assert.equal(options.method, "POST"); return { status: 200, json: async () => ({ data: { feedVersion: { id: "feed-1", version: "v1", lifecycle: "ready", createdAt: "2026-08-20T08:00:00Z", validatedAt: "2026-08-20T08:01:00Z", publishedAt: null, validFrom: "2026-08-20", validUntil: "2026-12-31", issueCounts: { error: 0, warning: 0, info: 0 } } }, error: null }) }; }, "https://api.example", "tenant/1", "feed/1");
  assert.equal(state.kind, "ready"); assert.equal(url, "https://api.example/v1/tenants/tenant%2F1/gtfs/versions/feed%2F1/generate");
});

test("loads and mutates tenant alerts through typed calls", async () => {
  const alert = { entityPublicId: "alert-1", tenantId: "tenant-1", feedVersionId: "feed-1", headerText: "Road closed", status: "draft" as const, createdAt: "2026-08-21T10:00:00Z" };
  let createdBody = "";
  const fetcher = async (_url: string, options: { method?: string; body?: string }) => { if (options.method === "POST") createdBody = options.body ?? ""; return { status: 200, json: async () => ({ data: options.method === "POST" || options.method === "PATCH" ? alert : [alert], error: null }) }; };
  const loaded = await fetchGtfsAlerts(fetcher, "https://api.example", "tenant-1");
  const created = await createGtfsAlert(fetcher, "https://api.example", "tenant-1", { headerText: "Road closed", routePublicIds: ["route-main"], stopPublicIds: ["stop-central"] });
  const changed = await setGtfsAlertStatus(fetcher, "https://api.example", "tenant-1", "alert-1", "published");
  assert.equal(loaded.kind, "ready"); assert.equal(loaded.alerts.length, 1); assert.equal(created.kind, "ready"); assert.equal(changed.kind, "ready"); assert.match(createdBody, /route-main/); assert.match(createdBody, /stop-central/);
});
