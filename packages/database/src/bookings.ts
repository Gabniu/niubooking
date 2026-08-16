// Ownership: tenant-scoped appointment persistence. All reads and writes carry tenant predicates.

import { validateBookingDraft, type Booking, type BookingDraft, type BookingStatus } from "@bookingapp/domain";
import type { SqlExecutor } from "./tenant-membership.js";

interface BookingRow { id: string; tenant_id: string; customer_id: string; service_name: string; starts_at: Date; ends_at: Date; status: BookingStatus; resource_ids?: string[]; }
function map(row: BookingRow): Booking { return { id: row.id, tenantId: row.tenant_id, customerId: row.customer_id, serviceName: row.service_name, startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at), status: row.status, ...(row.resource_ids?.length ? { resourceIds: row.resource_ids } : {}) }; }

const columns = "b.id, b.tenant_id, b.customer_id, b.service_name, b.starts_at, b.ends_at, b.status, COALESCE(array_agg(a.resource_id) FILTER (WHERE a.resource_id IS NOT NULL), '{}') AS resource_ids";

export async function listBookings(executor: SqlExecutor, tenantId: string, from?: Date, to?: Date): Promise<readonly Booking[]> {
  const rows = await executor.query<BookingRow>(`SELECT ${columns} FROM bookings b LEFT JOIN booking_resource_allocations a ON a.tenant_id = b.tenant_id AND a.booking_id = b.id WHERE b.tenant_id = $1 AND ($2::timestamptz IS NULL OR b.ends_at > $2) AND ($3::timestamptz IS NULL OR b.starts_at < $3) GROUP BY b.id ORDER BY b.starts_at, b.id`, [tenantId, from ?? null, to ?? null]);
  return rows.map(map);
}

export async function createBooking(executor: SqlExecutor, draft: BookingDraft): Promise<Booking> {
  const errors = validateBookingDraft(draft);
  if (errors.length) throw new Error(errors.join("; "));
  const resourceIds = [...new Set((draft.resourceIds ?? []).map((id) => id.trim()).filter(Boolean))];
  if (resourceIds.length !== (draft.resourceIds ?? []).length) throw new Error("Booking resources must be unique and non-empty");
  if (resourceIds.length) {
    const resources = await executor.query<{ id: string }>("SELECT id FROM booking_resources WHERE tenant_id = $1 AND id = ANY($2::text[]) AND status = 'active'", [draft.tenantId, resourceIds]);
    if (resources.length !== resourceIds.length) throw new Error("One or more booking resources are unavailable");
  }
  const rows = await executor.query<BookingRow>(`INSERT INTO bookings (id, tenant_id, customer_id, service_name, starts_at, ends_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, tenant_id, customer_id, service_name, starts_at, ends_at, status`, [draft.id, draft.tenantId, draft.customerId, draft.serviceName.trim(), draft.startsAt, draft.endsAt]);
  if (!rows[0]) throw new Error("Booking creation returned no row");
  for (const resourceId of resourceIds) await executor.query("INSERT INTO booking_resource_allocations (tenant_id, booking_id, resource_id, starts_at, ends_at) VALUES ($1,$2,$3,$4,$5)", [draft.tenantId, draft.id, resourceId, draft.startsAt, draft.endsAt]);
  return map({ ...rows[0], resource_ids: resourceIds });
}

export async function setBookingStatus(executor: SqlExecutor, tenantId: string, bookingId: string, status: BookingStatus): Promise<Booking | null> {
  const rows = await executor.query<BookingRow>(`UPDATE bookings SET status = $1, updated_at = now() WHERE tenant_id = $2 AND id = $3 RETURNING id, tenant_id, customer_id, service_name, starts_at, ends_at, status`, [status, tenantId, bookingId]);
  if (rows[0]) await executor.query("UPDATE booking_resource_allocations SET status = $1 WHERE tenant_id = $2 AND booking_id = $3", [status, tenantId, bookingId]);
  return rows[0] ? map(rows[0]) : null;
}
