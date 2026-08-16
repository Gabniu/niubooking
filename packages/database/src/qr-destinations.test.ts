import assert from "node:assert/strict";
import test from "node:test";
import { createQrDestination, listQrDestinations, readQrDestination, setQrDestinationStatus } from "./qr-destinations.js";

const row = { public_code: "branch-booking-code-01", tenant_id: "tenant-1", branch_id: "branch-1", pack_id: null, service_id: null, campaign: "front-desk", status: "active" as const, expires_at: null };

test("reads a QR destination with parameterized code", async () => {
  let params: readonly unknown[] = [];
  const value = await readQrDestination({ query: async <T>(_sql: string, p: readonly unknown[]) => { params = p; return [row] as T[]; } }, row.public_code);
  assert.equal(value?.tenantId, "tenant-1");
  assert.deepEqual(params, [row.public_code]);
});

test("creates and status-mutates a tenant-scoped destination", async () => {
  const queries: readonly unknown[][] = [];
  const executor = { query: async <T>(_sql: string, p: readonly unknown[]) => { (queries as unknown[][]).push([...p]); return [row] as T[]; } };
  await createQrDestination(executor, { publicCode: row.public_code, tenantId: row.tenant_id, branchId: row.branch_id, packId: null, serviceId: null, campaign: row.campaign, expiresAt: null });
  assert.equal(await setQrDestinationStatus(executor, "tenant-1", row.public_code, "paused"), true);
  assert.deepEqual(queries[1], ["paused", "tenant-1", row.public_code]);
});

test("lists destinations with tenant-scoped parameters", async () => {
  let params: readonly unknown[] = [];
  const values = await listQrDestinations({ query: async <T>(_sql: string, p: readonly unknown[]) => { params = p; return [row] as T[]; } }, "tenant-1");
  assert.equal(values.length, 1);
  assert.deepEqual(params, ["tenant-1"]);
});
