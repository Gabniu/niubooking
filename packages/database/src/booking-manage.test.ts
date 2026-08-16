import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { createBookingManageAdapter, issueBookingManageToken } from "./booking-manage.js";

const row = { id: "booking-1", tenant_id: "tenant-1", customer_id: "customer-1", service_name: "Consultation", starts_at: new Date("2099-08-14T09:00:00Z"), ends_at: new Date("2099-08-14T09:30:00Z"), status: "scheduled" as const, manage_token_hash: "hash", manage_token_expires_at: new Date("2100-01-01T00:00:00Z") };
function poolFor(mode: "read" | "reschedule" | "blocked") { const client = { async query(sql: string) { if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" || sql.startsWith("SELECT set_config")) return { rows: [] }; if (sql.startsWith("UPDATE bookings SET manage_token_hash")) return { rows: [{ id: row.id }] }; if (sql.startsWith("SELECT id, tenant_id")) return { rows: [row] }; if (sql.startsWith("SELECT resource_id")) return { rows: [{ resource_id: "room-1" }] }; if (sql.includes("FROM communication_settings")) return { rows: mode === "blocked" ? [{ tenant_id: "tenant-1", timezone: "UTC", reminders_enabled: true, feedback_enabled: true, default_feedback_frequency_days: 30, reschedule_enabled: false, cancellation_enabled: true, minimum_change_notice_minutes: 0 }] : [] }; if (sql.startsWith("INSERT INTO booking_manage_actions")) return { rows: mode === "reschedule" ? [{ idempotency_key: "move-1" }] : [] }; if (sql.startsWith("UPDATE bookings SET starts_at")) return { rows: [{ ...row, starts_at: new Date("2099-08-14T10:00:00Z"), ends_at: new Date("2099-08-14T10:30:00Z") }] }; if (sql.startsWith("UPDATE booking_resource_allocations")) return { rows: [] }; if (sql.startsWith("SELECT action")) return { rows: [{ action: "cancel", payload_hash: "hash" }] }; return { rows: [] }; }, release() {} }; return { connect: async () => client } as unknown as Pool; }
test("issues a signed manage capability and reschedules with resource continuity", async () => {
  const secret = "x".repeat(32);
  const executor = { query: async <T>() => [{ id: row.id }] as T[] };
  const token = await issueBookingManageToken(executor, { id: row.id, tenantId: row.tenant_id, customerId: row.customer_id, serviceName: row.service_name, startsAt: row.starts_at, endsAt: row.ends_at, status: row.status }, secret);
  assert.equal(token.split(".").length, 2);
  const adapter = createBookingManageAdapter(poolFor("reschedule"), secret);
  const read = await adapter.read(token);
  assert.deepEqual(read?.resourceIds, ["room-1"]);
  const moved = await adapter.reschedule(token, new Date("2099-08-14T10:00:00Z"), new Date("2099-08-14T10:30:00Z"), "move-1");
  assert.equal(moved?.startsAt.toISOString(), "2099-08-14T10:00:00.000Z");
  assert.equal(await adapter.read(`${token}tampered`), null);
});

test("enforces the organization rescheduling policy", async () => {
  const secret = "x".repeat(32);
  const token = await issueBookingManageToken({ query: async <T>() => [{ id: row.id }] as T[] }, { id: row.id, tenantId: row.tenant_id, customerId: row.customer_id, serviceName: row.service_name, startsAt: row.starts_at, endsAt: row.ends_at, status: row.status }, secret);
  await assert.rejects(() => createBookingManageAdapter(poolFor("blocked"), secret).reschedule(token, new Date("2099-08-14T10:00:00Z"), new Date("2099-08-14T10:30:00Z"), "move-1"), /Rescheduling is disabled/);
});
