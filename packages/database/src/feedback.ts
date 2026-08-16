// Ownership: feedback capability/response persistence. Used capabilities and duplicate submissions fail closed.

import type { FeedbackResponse, FeedbackTemplate } from "@bookingapp/domain";
import type { SqlExecutor } from "./tenant-membership.js";

export interface FeedbackCapability { capabilityId: string; tenantId: string; campaignId: string; templateVersion: number; customerId: string; expiresAt: Date; usedAt: Date | null; }

export interface FeedbackDeliveryCapability { capabilityId: string; tenantId: string; campaignId: string; templateVersion: number; customerId: string; expiresAt: Date; sourceJobId: string; }

export async function issueFeedbackCapability(executor: SqlExecutor, input: { jobId: string; tenantId: string; campaignId: string; templateVersion: number; customerId: string; expiresAt: Date; capabilityId?: string }): Promise<FeedbackDeliveryCapability> {
  const capabilityId = input.capabilityId ?? `feedback-${input.jobId}`;
  const rows = await executor.query<FeedbackDeliveryCapability>("INSERT INTO feedback_response_capabilities (capability_id, tenant_id, campaign_id, template_version, customer_id, expires_at, source_job_id) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (source_job_id) DO UPDATE SET expires_at = EXCLUDED.expires_at RETURNING capability_id AS \"capabilityId\", tenant_id AS \"tenantId\", campaign_id AS \"campaignId\", template_version AS \"templateVersion\", customer_id AS \"customerId\", expires_at AS \"expiresAt\", source_job_id AS \"sourceJobId\"", [capabilityId, input.tenantId, input.campaignId, input.templateVersion, input.customerId, input.expiresAt, input.jobId]);
  if (!rows[0]) throw new Error("Feedback capability issuance returned no row");
  return rows[0];
}

export async function readFeedbackCapability(executor: SqlExecutor, capabilityId: string): Promise<FeedbackCapability | null> {
  const rows = await executor.query<FeedbackCapability>("SELECT capability_id AS \"capabilityId\", tenant_id AS \"tenantId\", campaign_id AS \"campaignId\", template_version AS \"templateVersion\", customer_id AS \"customerId\", expires_at AS \"expiresAt\", used_at AS \"usedAt\" FROM feedback_response_capabilities WHERE capability_id = $1", [capabilityId]);
  return rows[0] ?? null;
}

export async function readFeedbackTemplate(executor: SqlExecutor, campaignId: string, version: number): Promise<FeedbackTemplate | null> {
  const rows = await executor.query<FeedbackTemplate>("SELECT campaign_id AS \"campaignId\", version, title, intro, presentation, questions_per_step AS \"questionsPerStep\", questions FROM feedback_templates WHERE campaign_id = $1 AND version = $2", [campaignId, version]);
  return rows[0] ?? null;
}

export async function submitFeedbackResponse(executor: SqlExecutor, response: FeedbackResponse): Promise<boolean> {
  const rows = await executor.query<{ capability_id: string }>("INSERT INTO feedback_responses (capability_id, tenant_id, campaign_id, template_version, customer_id, answers) SELECT $1, c.tenant_id, $2, $3, c.customer_id, $4 FROM feedback_response_capabilities c WHERE c.capability_id = $1 AND c.used_at IS NULL AND c.expires_at > now() ON CONFLICT (capability_id) DO NOTHING RETURNING capability_id", [response.capabilityId, response.campaignId, response.templateVersion, JSON.stringify(response.answers)]);
  if (rows.length === 0) return false;
  await executor.query("UPDATE feedback_response_capabilities SET used_at = now() WHERE capability_id = $1 AND used_at IS NULL", [response.capabilityId]);
  return true;
}
