// Ownership: production API adapter composition. Public capability lookups resolve an opaque ID first, then enter a tenant transaction.

import { aggregateFeedback, type FeedbackResponse } from "@bookingapp/domain";
import type { Pool } from "pg";
import { createBooking, listBookings, setBookingStatus } from "./bookings.js";
import { listCustomerContactMethods, upsertCustomerContactMethod, verifyContactMethodChallenge } from "./customer-contact-methods.js";
import { createCustomerProfile, listCustomerProfiles, readCustomerProfile, setCustomerProfileStatus, updateCustomerProfile } from "./customer-profiles.js";
import { createFeedbackCampaign, createFeedbackTemplate, listFeedbackCampaigns, setFeedbackCampaignStatus } from "./feedback-admin.js";
import { readFeedbackCapability, readFeedbackTemplate, submitFeedbackResponse } from "./feedback.js";
import { listFeedbackResponses } from "./feedback-responses-admin.js";
import { withTenantTransaction } from "./pg-executor.js";

export function createDatabaseCustomerAdmin(pool: Pool) {
  return {
    list: (tenantId: string, includeArchived = false) => withTenantTransaction(pool, tenantId, (executor) => listCustomerProfiles(executor, tenantId, includeArchived)),
    read: (tenantId: string, customerId: string) => withTenantTransaction(pool, tenantId, (executor) => readCustomerProfile(executor, tenantId, customerId)),
    create: (input: Parameters<typeof createCustomerProfile>[1]) => withTenantTransaction(pool, input.tenantId, (executor) => createCustomerProfile(executor, input)),
    update: (input: Parameters<typeof updateCustomerProfile>[1]) => withTenantTransaction(pool, input.tenantId, (executor) => updateCustomerProfile(executor, input)),
    setStatus: (tenantId: string, customerId: string, status: Parameters<typeof setCustomerProfileStatus>[3]) => withTenantTransaction(pool, tenantId, (executor) => setCustomerProfileStatus(executor, tenantId, customerId, status)),
  };
}

export function createDatabaseContactAdmin(pool: Pool) {
  return {
    list: (tenantId: string) => withTenantTransaction(pool, tenantId, (executor) => listCustomerContactMethods(executor, tenantId)),
    upsert: (input: Parameters<typeof upsertCustomerContactMethod>[1]) => withTenantTransaction(pool, input.tenantId, (executor) => upsertCustomerContactMethod(executor, input)),
  };
}

export function createDatabaseBookingAdmin(pool: Pool) {
  return {
    list: (tenantId: string, from?: Date, to?: Date) => withTenantTransaction(pool, tenantId, (executor) => listBookings(executor, tenantId, from, to)),
    create: (input: Parameters<typeof createBooking>[1]) => withTenantTransaction(pool, input.tenantId, (executor) => createBooking(executor, input)),
    setStatus: (tenantId: string, bookingId: string, status: Parameters<typeof setBookingStatus>[3]) => withTenantTransaction(pool, tenantId, (executor) => setBookingStatus(executor, tenantId, bookingId, status)),
  };
}

export function createDatabaseFeedbackAdmin(pool: Pool) {
  return {
    listCampaigns: (tenantId: string) => withTenantTransaction(pool, tenantId, (executor) => listFeedbackCampaigns(executor, tenantId)),
    createCampaign: (input: Parameters<typeof createFeedbackCampaign>[1]) => withTenantTransaction(pool, input.tenantId, (executor) => createFeedbackCampaign(executor, input)),
    createTemplate: (input: Parameters<typeof createFeedbackTemplate>[1]) => withTenantTransaction(pool, input.tenantId, (executor) => createFeedbackTemplate(executor, input)),
    setCampaignStatus: (tenantId: string, campaignId: string, enabled: boolean) => withTenantTransaction(pool, tenantId, (executor) => setFeedbackCampaignStatus(executor, tenantId, campaignId, enabled)),
  };
}

async function readPublicFeedbackCapability(pool: Pool, capabilityId: string) {
  const result = await pool.query<{ capabilityId: string; tenantId: string; campaignId: string; templateVersion: number; customerId: string; expiresAt: Date; usedAt: Date | null }>("SELECT capability_id AS \"capabilityId\", tenant_id AS \"tenantId\", campaign_id AS \"campaignId\", template_version AS \"templateVersion\", customer_id AS \"customerId\", expires_at AS \"expiresAt\", used_at AS \"usedAt\" FROM feedback_response_capabilities WHERE capability_id = $1 LIMIT 1", [capabilityId]);
  return result.rows[0] ?? null;
}

export function createDatabaseFeedbackPublic(pool: Pool) {
  return {
    async read(capabilityId: string) {
      const capability = await readPublicFeedbackCapability(pool, capabilityId);
      if (!capability) return null;
      const template = await withTenantTransaction(pool, capability.tenantId, (executor) => readFeedbackTemplate(executor, capability.campaignId, capability.templateVersion));
      return { ...capability, template };
    },
    async submit(input: { capabilityId: string; campaignId: string; templateVersion: number; customerId: string; answers: Readonly<Record<string, string | number>> }) {
      const capability = await readPublicFeedbackCapability(pool, input.capabilityId);
      if (!capability || capability.campaignId !== input.campaignId || capability.templateVersion !== input.templateVersion) return false;
      const response: FeedbackResponse = { ...input, submittedAt: new Date() };
      return withTenantTransaction(pool, capability.tenantId, (executor) => submitFeedbackResponse(executor, response));
    },
  };
}

export function createDatabaseFeedbackReporting(pool: Pool) {
  return {
    listResponses: (tenantId: string, campaignId?: string) => withTenantTransaction(pool, tenantId, (executor) => listFeedbackResponses(executor, tenantId, campaignId)),
    async analytics(tenantId: string, campaignId: string, templateVersion?: number) {
      return withTenantTransaction(pool, tenantId, async (executor) => {
        const versionRow = await executor.query<{ template_version: number }>("SELECT template_version FROM feedback_campaigns WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, campaignId]);
        const version = templateVersion ?? versionRow[0]?.template_version;
        if (!version) return null;
        const responses = await listFeedbackResponses(executor, tenantId, campaignId);
        return aggregateFeedback(campaignId, version, responses.filter((response) => response.templateVersion === version));
      });
    },
  };
}

export function createDatabaseContactVerification(pool: Pool) {
  return {
    async verify(challengeId: string, code: string) {
      const result = await pool.query<{ tenant_id: string }>("SELECT tenant_id FROM contact_verification_challenges WHERE id = $1 LIMIT 1", [challengeId]);
      const tenantId = result.rows[0]?.tenant_id;
      if (!tenantId) return "not_found" as const;
      return withTenantTransaction(pool, tenantId, (executor) => verifyContactMethodChallenge(executor, { challengeId, code }));
    },
  };
}
