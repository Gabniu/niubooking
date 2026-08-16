// Ownership: tenant-scoped, consent-aware contact resolution. Destinations leave this boundary only in worker memory.

import type { CommunicationChannel, CommunicationJob } from "@bookingapp/domain";
import type { SqlExecutor } from "./tenant-membership.js";
import { createHash } from "node:crypto";

interface ContactMethodRow { id: string; customer_id: string; channel: CommunicationChannel; destination: string; consent_status: "granted" | "denied" | "unknown"; verified_at: Date | null; enabled: boolean; priority: number; }
export interface ContactVerificationDeliveryTarget { id: string; tenantId: string; customerId: string; channel: CommunicationChannel; destination: string; consentStatus: "granted" | "denied" | "unknown"; enabled: boolean; }

export interface CustomerContactMethodSummary { id: string; customerId: string; customerName: string | null; channel: CommunicationChannel; maskedDestination: string; consentStatus: "granted" | "denied" | "unknown"; verifiedAt: Date | null; enabled: boolean; priority: number; }
export interface ContactVerificationChallenge { challengeId: string; expiresAt: Date; }
export type ContactVerificationResult = "verified" | "invalid" | "expired" | "locked" | "not_found";

export function isUsableCommunicationDestination(destination: string): boolean {
  return destination.length > 0 && destination.length <= 320 && destination.trim() === destination && !/[\u0000-\u001F\u007F]/.test(destination);
}

export function maskCommunicationDestination(channel: CommunicationChannel, destination: string): string {
  if (channel === "email") {
    const [local, domain] = destination.split("@", 2);
    if (!domain) return "••••••";
    return `${(local ?? "").slice(0, 1)}•••@${domain}`;
  }
  return `••••${destination.slice(-4)}`;
}

export async function listCustomerContactMethods(executor: SqlExecutor, tenantId: string): Promise<readonly CustomerContactMethodSummary[]> {
  const rows = await executor.query<ContactMethodRow & { customer_name: string | null }>(
    "SELECT m.id, m.customer_id, c.display_name AS customer_name, m.channel, m.destination, m.consent_status, m.verified_at, m.enabled, m.priority FROM customer_contact_methods m LEFT JOIN customers c ON c.tenant_id = m.tenant_id AND c.id = m.customer_id WHERE m.tenant_id = $1 ORDER BY c.display_name NULLS LAST, m.customer_id, m.channel, m.priority, m.updated_at DESC",
    [tenantId],
  );
  return rows.map((row) => ({ id: row.id, customerId: row.customer_id, customerName: row.customer_name, channel: row.channel, maskedDestination: maskCommunicationDestination(row.channel, row.destination), consentStatus: row.consent_status, verifiedAt: row.verified_at, enabled: row.enabled, priority: row.priority }));
}

export async function resolveCommunicationRecipient(executor: SqlExecutor, job: Pick<CommunicationJob, "tenantId" | "customerId" | "channel">): Promise<string | null> {
  if (!job.tenantId || !job.customerId) return null;
  const rows = await executor.query<ContactMethodRow>(
    `SELECT m.destination
       FROM customer_contact_methods m
      WHERE m.tenant_id = $1
        AND m.customer_id = $2
        AND m.channel = $3
        AND m.enabled = true
        AND m.consent_status = 'granted'
        AND m.verified_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM communication_opt_outs o
           WHERE o.tenant_id = m.tenant_id
             AND o.customer_id = m.customer_id
             AND o.channel = m.channel
        )
      ORDER BY m.priority ASC, m.updated_at DESC
      LIMIT 1`,
    [job.tenantId, job.customerId, job.channel],
  );
  const destination = rows[0]?.destination;
  return destination && isUsableCommunicationDestination(destination) ? destination : null;
}

export async function readContactVerificationTarget(executor: SqlExecutor, tenantId: string, contactMethodId: string): Promise<ContactVerificationDeliveryTarget | null> {
  const rows = await executor.query<{ id: string; tenant_id: string; customer_id: string; channel: CommunicationChannel; destination: string; consent_status: "granted" | "denied" | "unknown"; enabled: boolean }>("SELECT id, tenant_id, customer_id, channel, destination, consent_status, enabled FROM customer_contact_methods WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, contactMethodId]);
  const row = rows[0];
  if (!row || !row.enabled || row.consent_status !== "granted" || !isUsableCommunicationDestination(row.destination)) return null;
  return { id: row.id, tenantId: row.tenant_id, customerId: row.customer_id, channel: row.channel, destination: row.destination, consentStatus: row.consent_status, enabled: row.enabled };
}

export interface CustomerContactMethodDraft {
  id: string;
  tenantId: string;
  customerId: string;
  channel: CommunicationChannel;
  destination: string;
  consentStatus: "granted" | "denied" | "unknown";
  verifiedAt: Date | null;
  priority?: number;
}

export async function upsertCustomerContactMethod(executor: SqlExecutor, method: CustomerContactMethodDraft): Promise<void> {
  if (!isUsableCommunicationDestination(method.destination)) throw new Error("Contact destination is invalid");
  await executor.query(
    `INSERT INTO customer_contact_methods (id, tenant_id, customer_id, channel, destination, consent_status, verified_at, priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (tenant_id, customer_id, channel, destination)
     DO UPDATE SET consent_status = EXCLUDED.consent_status, verified_at = EXCLUDED.verified_at, priority = EXCLUDED.priority, enabled = true, updated_at = now()`,
    [method.id, method.tenantId, method.customerId, method.channel, method.destination, method.consentStatus, method.verifiedAt, method.priority ?? 1],
  );
}

function hashVerificationCode(challengeId: string, code: string): string { return createHash("sha256").update(`${challengeId}:${code}`).digest("hex"); }

export async function issueContactVerificationChallenge(executor: SqlExecutor, input: { challengeId: string; tenantId: string; contactMethodId: string; customerId: string; channel: CommunicationChannel; code: string; expiresAt: Date; maxAttempts?: number }): Promise<ContactVerificationChallenge> {
  if (!/^\d{6}$/.test(input.code)) throw new Error("Verification code must be six digits");
  await executor.query("UPDATE contact_verification_challenges SET consumed_at = now() WHERE tenant_id = $1 AND contact_method_id = $2 AND consumed_at IS NULL", [input.tenantId, input.contactMethodId]);
  await executor.query("INSERT INTO contact_verification_challenges (id, tenant_id, contact_method_id, customer_id, channel, code_hash, expires_at, max_attempts) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [input.challengeId, input.tenantId, input.contactMethodId, input.customerId, input.channel, hashVerificationCode(input.challengeId, input.code), input.expiresAt, input.maxAttempts ?? 5]);
  return { challengeId: input.challengeId, expiresAt: input.expiresAt };
}

export async function verifyContactMethodChallenge(executor: SqlExecutor, input: { challengeId: string; code: string }): Promise<ContactVerificationResult> {
  const codeHash = hashVerificationCode(input.challengeId, input.code);
  const attempts = await executor.query<{ tenant_id: string; contact_method_id: string; matches: boolean }>("UPDATE contact_verification_challenges SET attempts = attempts + 1, consumed_at = CASE WHEN code_hash = $2 THEN now() ELSE consumed_at END WHERE id = $1 AND consumed_at IS NULL AND expires_at > now() AND attempts < max_attempts RETURNING tenant_id, contact_method_id, code_hash = $2 AS matches", [input.challengeId, codeHash]);
  const attempt = attempts[0];
  if (attempt && !attempt.matches) return "invalid";
  if (attempt) {
    await executor.query("UPDATE customer_contact_methods SET verified_at = now(), enabled = true WHERE tenant_id = $1 AND id = $2", [attempt.tenant_id, attempt.contact_method_id]);
    return "verified";
  }
  const rows = await executor.query<{ expires_at: Date; attempts: number; max_attempts: number; consumed_at: Date | null }>("SELECT expires_at, attempts, max_attempts, consumed_at FROM contact_verification_challenges WHERE id = $1", [input.challengeId]);
  const row = rows[0];
  if (!row) return "not_found";
  if (row.consumed_at || row.attempts >= row.max_attempts) return "locked";
  if (row.expires_at.getTime() <= Date.now()) return "expired";
  return "invalid";
}

export async function revokeContactVerificationChallenge(executor: SqlExecutor, challengeId: string): Promise<void> {
  await executor.query("UPDATE contact_verification_challenges SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL", [challengeId]);
}
