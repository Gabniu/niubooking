// Ownership: tenant-scoped communication outbox adapter. Claims are atomic at the database boundary.

import type { CommunicationJob, CommunicationJobDraft, CommunicationJobKind, CommunicationJobStatus, CommunicationChannel } from "@bookingapp/domain";
import type { SqlExecutor } from "./tenant-membership.js";

interface JobRow { id: string; tenant_id: string; kind: CommunicationJobKind; channel: CommunicationChannel; idempotency_key: string; scheduled_for: Date; status: CommunicationJobStatus; booking_id: string | null; occurrence_id?: string | null; reservation_id?: string | null; customer_id: string; campaign_id?: string | null; template_version?: number | null; feedback_expires_at?: Date | null; }
function map(row: JobRow): CommunicationJob { return { id: row.id, tenantId: row.tenant_id, kind: row.kind, channel: row.channel, idempotencyKey: row.idempotency_key, scheduledFor: row.scheduled_for, status: row.status, bookingId: row.booking_id, ...(row.occurrence_id ? { occurrenceId: row.occurrence_id } : {}), ...(row.reservation_id ? { reservationId: row.reservation_id } : {}), customerId: row.customer_id, campaignId: row.campaign_id ?? null, templateVersion: row.template_version ?? null, feedbackExpiresAt: row.feedback_expires_at ?? null }; }

export async function enqueueCommunicationJob(executor: SqlExecutor, job: CommunicationJobDraft): Promise<CommunicationJob> {
  const rows = await executor.query<JobRow>("INSERT INTO communication_outbox (id, tenant_id, kind, channel, idempotency_key, scheduled_for, status, booking_id, occurrence_id, reservation_id, customer_id, campaign_id, template_version, feedback_expires_at) VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (tenant_id, idempotency_key) DO UPDATE SET scheduled_for = LEAST(communication_outbox.scheduled_for, EXCLUDED.scheduled_for) RETURNING id, tenant_id, kind, channel, idempotency_key, scheduled_for, status, booking_id, occurrence_id, reservation_id, customer_id, campaign_id, template_version, feedback_expires_at", [job.id, job.tenantId, job.kind, job.channel, job.idempotencyKey, job.scheduledFor, job.bookingId, job.occurrenceId ?? null, job.reservationId ?? null, job.customerId, job.campaignId ?? null, job.templateVersion ?? null, job.feedbackExpiresAt ?? null]);
  if (!rows[0]) throw new Error("Communication job enqueue returned no row");
  return map(rows[0]);
}

export async function claimDueCommunicationJobs(executor: SqlExecutor, limit: number, now: Date): Promise<readonly CommunicationJob[]> {
  const rows = await executor.query<JobRow>("UPDATE communication_outbox SET status = 'claimed', claimed_at = now() WHERE id IN (SELECT id FROM communication_outbox WHERE status = 'pending' AND scheduled_for <= $1 ORDER BY scheduled_for FOR UPDATE SKIP LOCKED LIMIT $2) RETURNING id, tenant_id, kind, channel, idempotency_key, scheduled_for, status, booking_id, occurrence_id, reservation_id, customer_id, campaign_id, template_version, feedback_expires_at", [now, limit]);
  return rows.map(map);
}

export async function completeCommunicationJob(executor: SqlExecutor, tenantId: string, id: string, status: Extract<CommunicationJobStatus, "sent" | "failed" | "suppressed" | "cancelled">): Promise<boolean> {
  const rows = await executor.query<{ id: string }>("UPDATE communication_outbox SET status = $1, completed_at = now() WHERE tenant_id = $2 AND id = $3 AND status = 'claimed' RETURNING id", [status, tenantId, id]);
  return rows.length > 0;
}

export async function cancelPendingBookingJobs(executor: SqlExecutor, tenantId: string, bookingId: string): Promise<number> {
  const rows = await executor.query<{ id: string }>("UPDATE communication_outbox SET status = 'cancelled', completed_at = now() WHERE tenant_id = $1 AND booking_id = $2 AND status = 'pending' RETURNING id", [tenantId, bookingId]);
  return rows.length;
}

export async function cancelPendingOccurrenceJobs(executor: SqlExecutor, tenantId: string, occurrenceId: string, reservationId?: string): Promise<number> {
  const rows = await executor.query<{ id: string }>("UPDATE communication_outbox SET status = 'cancelled', completed_at = now() WHERE tenant_id = $1 AND occurrence_id = $2 AND ($3::text IS NULL OR reservation_id = $3) AND status = 'pending' RETURNING id", [tenantId, occurrenceId, reservationId ?? null]);
  return rows.length;
}
