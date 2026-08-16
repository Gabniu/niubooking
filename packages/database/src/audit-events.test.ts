import assert from "node:assert/strict";
import test from "node:test";
import { appendAuditEvent } from "./audit-events.js";

test("appends an audit event without storing contact destinations", async () => {
  let parameters: readonly unknown[] = [];
  const executor = { query: async <T>(_sql: string, values: readonly unknown[]) => { parameters = values; return [{ id: "audit-1", tenant_id: "t1", actor_type: "user" as const, actor_id: "u1", action: "reservation.status_changed" as const, entity_type: "reservation" as const, entity_id: "r1", metadata: { to_status: "cancelled" }, occurred_at: new Date("2026-08-14T10:00:00Z") }] as T[]; } };
  const event = await appendAuditEvent(executor, { tenantId: "t1", actorType: "user", actorId: "u1", action: "reservation.status_changed", entityType: "reservation", entityId: "r1", metadata: { to_status: "cancelled" } });
  assert.equal(event.entityId, "r1");
  assert.match(String(parameters[7]), /to_status/);
  assert.doesNotMatch(String(parameters[7]), /@|phone|email/iu);
});
