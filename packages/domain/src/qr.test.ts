import assert from "node:assert/strict";
import test from "node:test";
import { resolveQrDestination, type QrDestination } from "./qr.js";

const destination: QrDestination = {
  publicCode: "branch-booking-code-01",
  tenantId: "tenant-1",
  branchId: "branch-1",
  packId: "dental",
  serviceId: "consultation",
  campaign: "front-desk",
  status: "active",
  expiresAt: null,
};

test("resolves an active opaque destination", async () => {
  const result = await resolveQrDestination({ findByPublicCode: async () => destination }, destination.publicCode);
  assert.equal(result.ok, true);
});

test("fails closed for malformed, paused, and expired destinations", async () => {
  assert.deepEqual(await resolveQrDestination({ findByPublicCode: async () => destination }, "short"), { ok: false, reason: "not_found" });
  assert.deepEqual(await resolveQrDestination({ findByPublicCode: async () => ({ ...destination, status: "paused" }) }, destination.publicCode), { ok: false, reason: "inactive" });
  assert.deepEqual(await resolveQrDestination({ findByPublicCode: async () => ({ ...destination, expiresAt: new Date("2020-01-01") }) }, destination.publicCode), { ok: false, reason: "expired" });
});
