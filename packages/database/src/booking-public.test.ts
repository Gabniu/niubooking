import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { createPublicBookingAdapter } from "./booking-public.js";

test("confirms a public hold before emitting booking and contact callbacks", async () => {
  let committed = false;
  const events: string[] = [];
  const hold = {
    hold_id: "hold-1", tenant_id: "tenant-1", public_code: "clinic", hold_token_hash: "", customer_name: "Ada Lovelace",
    service_name: "Consultation", starts_at: new Date("2030-08-14T09:00:00Z"), ends_at: new Date("2030-08-14T09:30:00Z"),
    expires_at: new Date("2030-08-14T10:00:00Z"), status: "held" as const, booking_id: null,
  };
  const client = {
    async query(sql: string) {
      if (sql === "BEGIN") return { rows: [] };
      if (sql.startsWith("SELECT set_config")) return { rows: [] };
      if (sql === "COMMIT") { committed = true; return { rows: [] }; }
      if (sql === "ROLLBACK") return { rows: [] };
      if (sql.startsWith("SELECT hold_id")) return { rows: [hold] };
      if (sql.startsWith("INSERT INTO customers")) return { rows: [{ id: "customer-1", tenant_id: "tenant-1", display_name: "Ada Lovelace", preferred_locale: null, timezone: null, status: "active" }] };
      if (sql.startsWith("INSERT INTO bookings")) return { rows: [{ id: "booking-1", tenant_id: "tenant-1", customer_id: "customer-1", service_name: "Consultation", starts_at: hold.starts_at, ends_at: hold.ends_at, status: "scheduled" }] };
      if (sql.startsWith("UPDATE bookings SET manage_token_hash")) return { rows: [{ id: "booking-1" }] };
      return { rows: [] };
    },
    release() {},
  };
  const pool = { connect: async () => client } as unknown as Pool;
  const adapter = createPublicBookingAdapter(pool, "x".repeat(32), {
    onConfirmed: async (event) => { assert.equal(committed, true); assert.equal(event.booking.id, "booking-1"); assert.deepEqual(event.contactChannels, ["email"]); events.push("booking"); },
    onContactCaptured: async ({ contactMethodId }) => { assert.equal(committed, true); assert.ok(contactMethodId); events.push("contact"); },
  });
  const token = "not-used-by-fake";
  hold.hold_token_hash = createHash("sha256").update(token).digest("hex");
  const result = await adapter.confirmHold({ tenantId: "tenant-1", publicCode: "clinic", holdId: "hold-1", holdToken: token, idempotencyKey: "confirm-1", contact: { channel: "email", destination: "ada@example.com", consentGranted: true } });
  assert.equal(result?.id, "booking-1");
  assert.deepEqual(events, ["booking", "contact"]);
  let unexpectedVerification = false;
  const noConsentAdapter = createPublicBookingAdapter(pool, "x".repeat(32), { onContactCaptured: async () => { unexpectedVerification = true; } });
  await noConsentAdapter.confirmHold({ tenantId: "tenant-1", publicCode: "clinic", holdId: "hold-1", holdToken: token, idempotencyKey: "confirm-2", contact: { channel: "sms", destination: "+254700000000", consentGranted: false } });
  assert.equal(unexpectedVerification, false);
});
test("persists selected resources on a public hold for authoritative allocation", async () => {
  const destination = { public_code: "clinic", tenant_id: "tenant-1", branch_id: null, pack_id: "dental", service_id: "consultation", campaign: null, status: "active" as const, expires_at: null };
  const hold = { hold_id: "hold-2", tenant_id: "tenant-1", public_code: "clinic", hold_token_hash: "", customer_name: "Ada", service_name: "Consultation", starts_at: new Date("2026-08-14T09:00:00Z"), ends_at: new Date("2026-08-14T09:30:00Z"), expires_at: new Date("2026-08-14T09:10:00Z"), status: "held" as const, booking_id: null, resource_ids: ["room-1"] };
  const client = { async query(sql: string) { if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" || sql.startsWith("SELECT set_config")) return { rows: [] }; if (sql.startsWith("SELECT public_code")) return { rows: [destination] }; if (sql.startsWith("SELECT id FROM booking_resources")) return { rows: [{ id: "room-1" }] }; if (sql.startsWith("SELECT hold_id")) return { rows: [] }; if (sql.startsWith("INSERT INTO booking_holds")) return { rows: [hold] }; return { rows: [] }; }, release() {} };
  const adapter = createPublicBookingAdapter({ connect: async () => client } as unknown as Pool, "x".repeat(32));
  const result = await adapter.createHold({ tenantId: "tenant-1", publicCode: "clinic", customerName: "Ada", serviceName: "Consultation", startsAt: hold.starts_at, endsAt: hold.ends_at, idempotencyKey: "request-2", resourceIds: ["room-1"] });
  assert.deepEqual(result.resourceIds, ["room-1"]);
});
test("revalidates typed requirement assignments before creating a public hold", async () => {
  const destination = { public_code: "clinic", tenant_id: "tenant-1", branch_id: null, pack_id: "driving-school", service_id: "lesson", campaign: null, status: "active" as const, expires_at: null };
  const hold = { hold_id: "hold-3", tenant_id: "tenant-1", public_code: "clinic", hold_token_hash: "", customer_name: "Ada", service_name: "Lesson", starts_at: new Date("2026-08-14T09:00:00Z"), ends_at: new Date("2026-08-14T10:00:00Z"), expires_at: new Date("2026-08-14T09:10:00Z"), status: "held" as const, booking_id: null, resource_ids: ["staff-1", "car-1"], requirement_assignments: [{ requirementId: "instructor", resourceIds: ["staff-1"] }, { requirementId: "vehicle", resourceIds: ["car-1"] }] };
  const client = { async query(sql: string) { if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" || sql.startsWith("SELECT set_config")) return { rows: [] }; if (sql.startsWith("SELECT public_code")) return { rows: [destination] }; if (sql.startsWith("SELECT id, tenant_id, service_id")) return { rows: [{ id: "instructor", tenant_id: "tenant-1", service_id: "lesson", variant_id: null, kind: "resource", label: "Instructor", quantity: 1, resource_type: null, capability_key: "driving.instructor", status: "active" }, { id: "vehicle", tenant_id: "tenant-1", service_id: "lesson", variant_id: null, kind: "resource", label: "Vehicle", quantity: 1, resource_type: "vehicle", capability_key: null, status: "active" }] }; if (sql.startsWith("SELECT id, tenant_id, name")) return { rows: [{ id: "staff-1", tenant_id: "tenant-1", name: "Sam", resource_type: "staff", capabilities: ["driving.instructor"], status: "active" }, { id: "car-1", tenant_id: "tenant-1", name: "Car", resource_type: "vehicle", capabilities: [], status: "active" }] }; if (sql.startsWith("SELECT id FROM booking_resources")) return { rows: [{ id: "staff-1" }, { id: "car-1" }] }; if (sql.startsWith("SELECT hold_id")) return { rows: [] }; if (sql.startsWith("INSERT INTO booking_holds")) return { rows: [hold] }; return { rows: [] }; }, release() {} };
  const adapter = createPublicBookingAdapter({ connect: async () => client } as unknown as Pool, "x".repeat(32));
  const result = await adapter.createHold({ tenantId: "tenant-1", publicCode: "clinic", customerName: "Ada", serviceName: "Lesson", startsAt: hold.starts_at, endsAt: hold.ends_at, idempotencyKey: "request-3", requirementAssignments: hold.requirement_assignments });
  assert.deepEqual(result.requirementAssignments, hold.requirement_assignments);
});
