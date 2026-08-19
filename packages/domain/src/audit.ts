// Ownership: durable, tenant-scoped audit vocabulary shared by mutation adapters.

export type AuditActorType = "user" | "system" | "integration";
export type AuditAction = "reservation.status_changed" | "transport.boarded" | "transport.seats_assigned";

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorType: AuditActorType;
  actorId: string | null;
  action: AuditAction;
  entityType: "reservation";
  entityId: string;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  occurredAt: Date;
}

export function validateAuditMetadata(metadata: Readonly<Record<string, unknown>>): string[] {
  const errors: string[] = [];
  if (Object.keys(metadata).length > 24) errors.push("Audit metadata has too many fields");
  for (const [key, value] of Object.entries(metadata)) {
    if (!/^[a-z][a-z0-9_]{0,63}$/u.test(key)) errors.push("Audit metadata keys must be lowercase identifiers");
    if (value !== null && !["string", "number", "boolean"].includes(typeof value)) errors.push("Audit metadata values must be scalar");
    if (typeof value === "number" && !Number.isFinite(value)) errors.push("Audit metadata numbers must be finite");
  }
  return errors;
}
