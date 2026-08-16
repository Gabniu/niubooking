import assert from "node:assert/strict";
import test from "node:test";
import { createQrDestination, fetchQrDestinations, setQrDestinationStatus } from "./qr-admin-client.js";

test("maps authorized QR destinations into the Print Studio selector state", async () => {
  const state = await fetchQrDestinations(async (url, init) => { assert.match(url, /tenant-1/); assert.equal(init?.credentials, "include"); return { ok: true, status: 200, json: async () => ({ data: [{ publicCode: "branch-booking-code-01", tenantId: "tenant-1", branchId: null, packId: null, serviceId: null, campaign: null, status: "active", expiresAt: null }], error: null }) }; }, "https://booking.example", "tenant-1");
  assert.equal(state.kind, "ready");
});

test("maps tenant denial to a recoverable state", async () => {
  const state = await fetchQrDestinations(async () => ({ ok: false, status: 403, json: async () => ({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } }) }), "", "tenant-1");
  assert.equal(state.kind, "denied");
});

test("creates and changes a QR destination through typed staff calls", async () => {
  const fetcher = async (url: string, init?: { method?: "POST"; body?: string }) => { assert.match(url, /qr-destinations/); if (init?.method === "POST" && url.endsWith("status")) return { ok: true, status: 200, json: async () => ({ data: { publicCode: "code-1", status: "paused" }, error: null }) }; return { ok: true, status: 201, json: async () => ({ data: { publicCode: "code-1", tenantId: "tenant-1", branchId: "front", packId: null, serviceId: "service", campaign: null, status: "active", expiresAt: null }, error: null }) }; };
  const created = await createQrDestination(fetcher, "", "tenant-1", { branchId: "front", serviceId: "service" });
  assert.equal(created.kind, "ready");
  const changed = await setQrDestinationStatus(fetcher, "", "tenant-1", "code-1", "paused");
  assert.equal(changed.kind, "ready");
});
