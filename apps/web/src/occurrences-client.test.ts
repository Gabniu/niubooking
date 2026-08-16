import assert from "node:assert/strict";
import test from "node:test";
import { createOccurrence, fetchOccurrences, fetchReservations, updateReservationStatus } from "./occurrences-client.js";

const occurrence = { id: "o1", tenantId: "t1", serviceId: "s1", label: "Class", startsAt: "2026-08-20T08:00:00.000Z", endsAt: "2026-08-20T09:00:00.000Z", status: "open" as const, capacity: 10, reservedQuantity: 2 };
const reservation = { id: "r1", tenantId: "t1", occurrenceId: "o1", customerId: "c1", quantity: 1, status: "confirmed" as const };
const fetcher = async (_url: string, init: { credentials: "include"; method?: "POST" }) => ({ status: 201, json: async () => init.method === "POST" ? { data: occurrence, error: null } : { data: [occurrence], error: null } });

test("maps occurrence list data into a ready state", async () => {
  const result = await fetchOccurrences(fetcher, "", "tenant-1");
  assert.equal(result.kind, "ready");
  if (result.kind === "ready") assert.equal(result.occurrences[0]?.label, "Class");
});

test("creates an occurrence through the typed contract", async () => {
  const result = await createOccurrence(fetcher, "", "tenant-1", { serviceId: "s1", label: "Class", startsAt: occurrence.startsAt, endsAt: occurrence.endsAt, capacity: 10 });
  assert.equal(result.kind, "ready");
});

test("loads and updates reservations through typed staff client calls", async () => {
  const reservationFetcher = async (_url: string, init: { credentials: "include"; method?: "POST" }) => ({ status: 200, json: async () => init.method === "POST" ? { data: { ...reservation, status: "completed" }, error: null } : { data: [reservation], error: null } });
  const listed = await fetchReservations(reservationFetcher, "", "tenant-1", "o1");
  assert.equal(listed.kind, "ready");
  const changed = await updateReservationStatus(reservationFetcher, "", "tenant-1", "o1", "r1", "completed");
  assert.equal(changed.kind, "ready");
});
