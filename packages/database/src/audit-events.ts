// Ownership: append-only tenant audit persistence. Sensitive destinations never enter metadata.

import { randomUUID } from "node:crypto";
import { validateAuditMetadata, type AuditAction, type AuditActorType, type AuditEvent } from "@bookingapp/domain";
import type { SqlExecutor } from "./tenant-membership.js";

interface AuditRow { id: string; tenant_id: string; actor_type: AuditActorType; actor_id: string | null; action: AuditAction; entity_type: "reservation"; entity_id: string; metadata: Readonly<Record<string, string | number | boolean | null>>; occurred_at: Date; }
function map(row: AuditRow): AuditEvent { return { id: row.id, tenantId: row.tenant_id, actorType: row.actor_type, actorId: row.actor_id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, metadata: row.metadata, occurredAt: new Date(row.occurred_at) }; }

export async function appendAuditEvent(executor: SqlExecutor, input: { tenantId: string; actorType: AuditActorType; actorId: string | null; action: AuditAction; entityType: "reservation"; entityId: string; metadata: Readonly<Record<string, string | number | boolean | null>> }): Promise<AuditEvent> {
  const errors = validateAuditMetadata(input.metadata);
  if (errors.length) throw new Error(errors.join("; "));
  const rows = await executor.query<AuditRow>("INSERT INTO audit_events (id, tenant_id, actor_type, actor_id, action, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id, tenant_id, actor_type, actor_id, action, entity_type, entity_id, metadata, occurred_at", [randomUUID(), input.tenantId, input.actorType, input.actorId, input.action, input.entityType, input.entityId, JSON.stringify(input.metadata)]);
  if (!rows[0]) throw new Error("Audit event could not be recorded");
  return map(rows[0]);
}
