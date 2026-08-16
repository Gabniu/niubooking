import assert from "node:assert/strict";
import test from "node:test";
import { createBooking, listBookings, setBookingStatus } from "./bookings.js";

const row = { id: "booking-1", tenant_id: "tenant-1", customer_id: "customer-1", service_name: "Consultation", starts_at: new Date("2026-08-14T09:00:00Z"), ends_at: new Date("2026-08-14T09:30:00Z"), status: "scheduled" as const };

test("lists bookings with tenant and time-window predicates", async () => {
  let values: readonly unknown[] = [];
  const result = await listBookings({ query: async <T>(_sql: string, params: readonly unknown[]) => { values = params; return [row] as T[]; } }, "tenant-1", row.starts_at, row.ends_at);
  assert.equal(result[0]?.customerId, "customer-1");
  assert.equal(values[0], "tenant-1");
});

test("creates and status-mutates a booking", async () => {
  const executor = { query: async <T>() => [row] as T[] };
  assert.equal((await createBooking(executor, { id: "booking-1", tenantId: "tenant-1", customerId: "customer-1", serviceName: " Consultation ", startsAt: row.starts_at, endsAt: row.ends_at })).serviceName, "Consultation");
  assert.equal((await setBookingStatus(executor, "tenant-1", "booking-1", "completed"))?.id, "booking-1");
});

test("surfaces a conflict from the database commit boundary", async () => {
  const executor = { query: async <T>() => [] as T[] };
  await assert.rejects(() => createBooking(executor, { id: "booking-2", tenantId: "tenant-1", customerId: "customer-1", serviceName: "Consultation", startsAt: row.starts_at, endsAt: row.ends_at }), /creation returned no row/);
});
