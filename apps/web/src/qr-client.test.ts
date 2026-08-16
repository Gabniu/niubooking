import assert from "node:assert/strict";
import test from "node:test";
import { fetchPublicQr } from "./qr-client.js";

test("maps a public QR response to a ready state", async () => {
  const state = await fetchPublicQr(async (url) => ({ ok: true, status: 200, json: async () => ({ data: { publicCode: "branch-booking-code-01", tenantId: "tenant-1", branchId: null, packId: null, serviceId: null, campaign: null }, error: null }) }), "https://booking.test", "branch-booking-code-01");
  assert.equal(state.kind, "ready");
});

test("maps paused and expired links to a recoverable unavailable state", async () => {
  const state = await fetchPublicQr(async () => ({ ok: false, status: 410, json: async () => ({ data: null, error: { code: "QR_INACTIVE", message: "This booking link is temporarily unavailable." } }) }), "", "branch-booking-code-01");
  assert.deepEqual(state, { kind: "unavailable", message: "This booking link is not active." });
});
