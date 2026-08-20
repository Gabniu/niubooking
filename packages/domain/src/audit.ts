// Ownership: durable, tenant-scoped audit vocabulary shared by mutation adapters.

export type AuditActorType = "user" | "system" | "integration";
export type AuditAction =
  | "reservation.status_changed"
  | "transport.boarded"
  | "transport.seats_assigned"
  | "gtfs.feed_published"
  | "gtfs.feed_withdrawn"
  | "gtfs.feed_rolled_back"
  | "fleet.device_enrolled"
  | "fleet.device_revoked"
  | "fleet.trip_assigned"
  | "fleet.tracking_started"
  | "fleet.tracking_handover"
  | "fleet.tracking_ended";
export type AuditEntityType =
  | "reservation"
  | "gtfs_feed_version"
  | "fleet_device"
  | "transport_trip_assignment"
  | "fleet_tracking_session";

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorType: AuditActorType;
  actorId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
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
