// Ownership: authorized response reporting. Return only tenant-scoped operational fields, never raw contact secrets.

import type { SqlExecutor } from "./tenant-membership.js";

export interface FeedbackResponseSummary { capabilityId: string; campaignId: string; templateVersion: number; customerId: string; answers: Readonly<Record<string, string | number>>; submittedAt: Date; }

export async function listFeedbackResponses(executor: SqlExecutor, tenantId: string, campaignId?: string): Promise<readonly FeedbackResponseSummary[]> {
  const rows = await executor.query<FeedbackResponseSummary>("SELECT capability_id AS \"capabilityId\", campaign_id AS \"campaignId\", template_version AS \"templateVersion\", customer_id AS \"customerId\", answers, submitted_at AS \"submittedAt\" FROM feedback_responses WHERE tenant_id = $1 AND ($2::text IS NULL OR campaign_id = $2) ORDER BY submitted_at DESC", [tenantId, campaignId ?? null]);
  return rows;
}
