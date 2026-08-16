// Ownership: persistence contract proof for universal occurrence admission.

import assert from "node:assert/strict";
import test from "node:test";
import { createOccurrence, createPublicOccurrenceReservation, createReservation, listOccurrences, listReservations, setReservationStatus } from "./occurrences.js";

const occurrenceRow = { id: "o1", tenant_id: "t1", service_id: "s1", label: "Class", starts_at: new Date("2026-08-20T08:00:00Z"), ends_at: new Date("2026-08-20T09:00:00Z"), status: "open" as const, capacity: 10, reserved_quantity: 2 };
const reservationRow = { id: "r1", tenant_id: "t1", occurrence_id: "o1", customer_id: "c1", quantity: 1, status: "confirmed" as const };

test("lists occurrences with tenant and time predicates", async () => {
  const executor = { query: async <T>() => [occurrenceRow] as T[] };
  const result = await listOccurrences(executor, "t1", occurrenceRow.starts_at, occurrenceRow.ends_at);
  assert.equal(result[0]?.serviceId, "s1");
});

test("creates an occurrence only after domain validation", async () => {
  let statement = "";
  const executor = { query: async <T>(sql: string) => { statement = sql; return [occurrenceRow] as T[]; } };
  const result = await createOccurrence(executor, { id: "o1", tenantId: "t1", serviceId: "s1", label: "Class", startsAt: occurrenceRow.starts_at, endsAt: occurrenceRow.ends_at, capacity: 10 });
  assert.equal(result.capacity, 10);
  assert.match(statement, /INSERT INTO service_occurrences/iu);
});

test("admits a reservation through an atomic capacity update", async () => {
  const statements: string[] = [];
  const executor = { query: async <T>(sql: string) => { statements.push(sql); return (sql.startsWith("UPDATE") ? [occurrenceRow] : [reservationRow]) as T[]; } };
  const result = await createReservation(executor, { id: "r1", tenantId: "t1", occurrenceId: "o1", customerId: "c1", quantity: 1 });
  assert.equal(result.occurrenceId, "o1");
  assert.match(statements[0] ?? "", /reserved_quantity = reserved_quantity \+ \$3/iu);
  assert.match(statements[1] ?? "", /INSERT INTO service_reservations/iu);
});

test("lists reservations and releases capacity when staff cancels one", async () => {
  const statements: string[] = [];
  const executor = { query: async <T>(sql: string) => {
    statements.push(sql);
    if (sql.startsWith("SELECT") && sql.includes("service_reservations") && sql.includes("FOR UPDATE")) return [reservationRow] as T[];
    if (sql.startsWith("SELECT") && sql.includes("service_reservations")) return [reservationRow] as T[];
    if (sql.startsWith("UPDATE service_occurrences")) return [occurrenceRow] as T[];
    if (sql.startsWith("UPDATE service_reservations")) return [{ ...reservationRow, status: "cancelled" }] as T[];
    if (sql.startsWith("INSERT INTO audit_events")) return [{ id: "audit-1", tenant_id: "t1", actor_type: "user", actor_id: "u1", action: "reservation.status_changed", entity_type: "reservation", entity_id: "r1", metadata: {}, occurred_at: new Date() }] as T[];
    return [] as T[];
  } };
  const listed = await listReservations(executor, "t1", "o1");
  const changed = await setReservationStatus(executor, { tenantId: "t1", occurrenceId: "o1", reservationId: "r1", status: "cancelled", actorId: "u1" });
  assert.equal(listed[0]?.id, "r1");
  assert.equal(changed.status, "cancelled");
  assert.match(statements[2] ?? "", /reserved_quantity = reserved_quantity - \$3/iu);
  assert.ok(statements.some((statement) => statement.startsWith("INSERT INTO audit_events")));
});

test("creates a tenant-safe public reservation with an idempotency boundary", async () => {
  let reservationLookup = 0;
  const executor = { query: async <T>(sql: string) => {
    if (sql.includes("pg_advisory_xact_lock")) return [] as T[];
    if (sql.includes("FROM service_reservations")) { reservationLookup += 1; return [] as T[]; }
    if (sql.includes("FROM qr_destinations")) return [{ tenant_id: "t1", public_code: "qr-public-code-1", branch_id: null, pack_id: "fitness", service_id: "s1", campaign: null, status: "active", expires_at: null }] as T[];
    if (sql.includes("SELECT service_id")) return [{ service_id: "s1" }] as T[];
    if (sql.includes("INSERT INTO customers")) return [{ id: "c-public", tenant_id: "t1", display_name: "Alex", preferred_locale: null, timezone: null, status: "active" }] as T[];
    if (sql.startsWith("UPDATE service_occurrences")) return [occurrenceRow] as T[];
    if (sql.includes("INSERT INTO service_reservations")) return [{ ...reservationRow, customer_id: "c-public" }] as T[];
    return [] as T[];
  } };
  const result = await createPublicOccurrenceReservation(executor, { tenantId: "t1", publicCode: "qr-public-code-1", occurrenceId: "o1", customerName: "Alex", quantity: 1, idempotencyKey: "public-request-1" });
  assert.equal(result.customerId, "c-public");
  assert.equal(reservationLookup, 2);
});

test("emits the public occurrence event only after its transaction commits", async () => {
  const calls: string[] = [];
  const client = { query: async <T>(sql: string) => {
    calls.push(sql);
    if (sql === "BEGIN" || sql === "COMMIT" || sql.startsWith("SELECT set_config") || sql.includes("pg_advisory_xact_lock")) return { rows: [] as T[] };
    if (sql.includes("FROM service_reservations")) return { rows: [] as T[] };
    if (sql.includes("FROM qr_destinations")) return { rows: [{ tenant_id: "t1", public_code: "qr-public-code-1", branch_id: null, pack_id: "fitness", service_id: "s1", campaign: null, status: "active", expires_at: null }] as T[] };
    if (sql.includes("SELECT service_id") || sql.includes("SELECT id, tenant_id, service_id")) return { rows: [occurrenceRow] as T[] };
    if (sql.includes("INSERT INTO customers")) return { rows: [{ id: "c-public", tenant_id: "t1", display_name: "Alex", preferred_locale: null, timezone: null, status: "active" }] as T[] };
    if (sql.startsWith("UPDATE service_occurrences")) return { rows: [occurrenceRow] as T[] };
    if (sql.includes("INSERT INTO service_reservations")) return { rows: [{ ...reservationRow, customer_id: "c-public" }] as T[] };
    return { rows: [] as T[] };
  }, release() {} };
  const admin = (await import("./occurrences.js")).createDatabaseOccurrenceAdmin({ connect: async () => client } as never, { onPublicReserved: async () => { assert.equal(calls.at(-1), "COMMIT"); calls.push("callback"); } });
  await admin.reservePublic({ tenantId: "t1", publicCode: "qr-public-code-1", occurrenceId: "o1", customerName: "Alex", quantity: 1, idempotencyKey: "public-request-2" });
  assert.deepEqual(calls.slice(-2), ["COMMIT", "callback"]);
});

test("emits reservation lifecycle callbacks only after audit and commit", async () => {
  const calls: string[] = [];
  const client = { query: async <T>(sql: string) => {
    calls.push(sql);
    if (sql === "BEGIN" || sql === "COMMIT" || sql.startsWith("SELECT set_config") || sql.includes("INSERT INTO audit_events")) return { rows: sql.includes("INSERT INTO audit_events") ? [{ id: "audit-1", tenant_id: "t1", actor_type: "user", actor_id: "u1", action: "reservation.status_changed", entity_type: "reservation", entity_id: "r1", metadata: {}, occurred_at: new Date() }] as T[] : [] as T[] };
    if (sql.includes("service_reservations") && sql.includes("FOR UPDATE")) return { rows: [reservationRow] as T[] };
    if (sql.startsWith("UPDATE service_occurrences")) return { rows: [occurrenceRow] as T[] };
    if (sql.startsWith("UPDATE service_reservations")) return { rows: [{ ...reservationRow, status: "cancelled" }] as T[] };
    return { rows: [] as T[] };
  }, release() {} };
  const admin = (await import("./occurrences.js")).createDatabaseOccurrenceAdmin({ connect: async () => client } as never, { onReservationStatusChanged: async (event) => { assert.equal(calls.at(-1), "COMMIT"); assert.equal(event.reservation.status, "cancelled"); calls.push("callback"); } });
  await admin.setReservationStatus({ tenantId: "t1", occurrenceId: "o1", reservationId: "r1", status: "cancelled", actorId: "u1" });
  assert.deepEqual(calls.slice(-2), ["COMMIT", "callback"]);
});
