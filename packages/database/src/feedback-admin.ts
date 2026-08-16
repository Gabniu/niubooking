// Ownership: authorized feedback campaign/template persistence. New versions are append-only.

import { campaignFromDraft, validateFeedbackTemplate, type FeedbackCampaign, type FeedbackCampaignDraft, type FeedbackTemplate } from "@bookingapp/domain";
import type { SqlExecutor } from "./tenant-membership.js";

export async function listFeedbackCampaigns(executor: SqlExecutor, tenantId: string): Promise<readonly FeedbackCampaign[]> {
  const rows = await executor.query<FeedbackCampaign>("SELECT id, tenant_id AS \"tenantId\", enabled, audience, template_version AS \"templateVersion\", frequency_cap_days AS \"frequencyCapDays\", expires_after_days AS \"expiresAfterDays\" FROM feedback_campaigns WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]);
  return rows;
}

export async function createFeedbackCampaign(executor: SqlExecutor, draft: FeedbackCampaignDraft): Promise<FeedbackCampaign> {
  const campaign = campaignFromDraft(draft);
  const rows = await executor.query<FeedbackCampaign>("INSERT INTO feedback_campaigns (id, tenant_id, enabled, audience, template_version, frequency_cap_days, expires_after_days) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, tenant_id AS \"tenantId\", enabled, audience, template_version AS \"templateVersion\", frequency_cap_days AS \"frequencyCapDays\", expires_after_days AS \"expiresAfterDays\"", [campaign.id, campaign.tenantId, campaign.enabled, campaign.audience, campaign.templateVersion, campaign.frequencyCapDays, campaign.expiresAfterDays]);
  if (!rows[0]) throw new Error("Feedback campaign insert returned no row");
  return rows[0];
}

export async function setFeedbackCampaignStatus(executor: SqlExecutor, tenantId: string, campaignId: string, enabled: boolean): Promise<boolean> {
  const campaigns = await executor.query<{ templateVersion: number }>("SELECT template_version AS \"templateVersion\" FROM feedback_campaigns WHERE id = $1 AND tenant_id = $2 LIMIT 1", [campaignId, tenantId]);
  const campaign = campaigns[0];
  if (!campaign) return false;
  if (enabled) {
    const templates = await executor.query<{ id: string }>("SELECT campaign_id AS id FROM feedback_templates WHERE campaign_id = $1 AND tenant_id = $2 AND version = $3 LIMIT 1", [campaignId, tenantId, campaign.templateVersion]);
    if (!templates[0]) throw new Error("A campaign must have a matching template version before it can be enabled");
  }
  const rows = await executor.query<{ id: string }>("UPDATE feedback_campaigns SET enabled = $3 WHERE id = $1 AND tenant_id = $2 RETURNING id", [campaignId, tenantId, enabled]);
  return Boolean(rows[0]);
}

export async function createFeedbackTemplate(executor: SqlExecutor, template: FeedbackTemplate & { tenantId: string }): Promise<FeedbackTemplate> {
  const errors = validateFeedbackTemplate(template);
  if (errors.length) throw new Error(errors.join("; "));
  const campaigns = await executor.query<{ id: string }>("SELECT id FROM feedback_campaigns WHERE id = $1 AND tenant_id = $2 LIMIT 1", [template.campaignId, template.tenantId]);
  if (!campaigns[0]) throw new Error("Feedback campaign was not found in this workspace");
  const rows = await executor.query<FeedbackTemplate>("INSERT INTO feedback_templates (campaign_id, tenant_id, version, title, intro, presentation, questions_per_step, questions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING campaign_id AS \"campaignId\", version, title, intro, presentation, questions_per_step AS \"questionsPerStep\", questions", [template.campaignId, template.tenantId, template.version, template.title, template.intro, template.presentation, template.questionsPerStep, JSON.stringify(template.questions)]);
  if (!rows[0]) throw new Error("Feedback template insert returned no row");
  return rows[0];
}
