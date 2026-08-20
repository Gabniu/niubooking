// Ownership: authorized GTFS publication readiness and validation routes.

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { GtfsFeatureReadiness, GtfsPublicationStatus, GtfsValidationReportResponse } from "@bookingapp/contracts";
import type { GtfsFeedPublicationStatus, GtfsValidationIssue } from "@bookingapp/database";
import type { TenantContextRequest } from "./tenant-context-handler.js";

export interface GtfsPublicationAdmin {
  readStatus(tenantId: string): Promise<GtfsFeedPublicationStatus | null>;
  readValidation(input: { tenantId: string; feedVersionId: string }): Promise<readonly GtfsValidationIssue[] | null>;
}

interface RouteDependencies { resolve(request: FastifyRequest<{ Params: { tenantId: string } }>): TenantContextRequest | Promise<TenantContextRequest>; gtfsPublication?: GtfsPublicationAdmin; }
const previewRoles = ["owner", "admin", "manager", "dispatcher"] as const;

function admitted(context: TenantContextRequest, tenantId: string): boolean {
  return Boolean(context.identity && context.membership && context.membership.tenantId === tenantId && previewRoles.includes(context.membership.role as typeof previewRoles[number]));
}

function counts(value: Readonly<Record<"error" | "warning" | "info", number>> | undefined): Readonly<Record<"error" | "warning" | "info", number>> {
  return value ?? { error: 0, warning: 0, info: 0 };
}

function versionSummary(version: NonNullable<GtfsFeedPublicationStatus["activeVersion"]>, issueCounts: GtfsFeedPublicationStatus["issueCounts"]): GtfsPublicationStatus["activeSchedule"] {
  const issueCount = counts(issueCounts[version.id]);
  return { id: version.id, version: version.version, lifecycle: version.status, createdAt: version.createdAt.toISOString(), validatedAt: version.validatedAt?.toISOString() ?? null, publishedAt: version.publishedAt?.toISOString() ?? null, validFrom: version.validFrom, validUntil: version.validUntil, issueCounts: issueCount };
}

function readiness(status: GtfsFeedPublicationStatus): readonly GtfsFeatureReadiness[] {
  const scheduleState = status.settings.schedulePublicationEnabled ? "enabled" : "ready";
  const latestCounts = status.latestVersion ? counts(status.issueCounts[status.latestVersion.id]) : counts(undefined);
  return status.settings.enabledFeatures.map((feature) => ({ feature, state: latestCounts.error > 0 ? "incomplete" : scheduleState, blockingIssueCount: latestCounts.error, warningCount: latestCounts.warning }));
}

function statusJson(status: GtfsFeedPublicationStatus): GtfsPublicationStatus {
  const active = status.activeVersion ? versionSummary(status.activeVersion, status.issueCounts) : null;
  const latest = status.latestVersion ? versionSummary(status.latestVersion, status.issueCounts) : null;
  return { organizationId: status.settings.tenantId, publicScheduleUrl: null, publicVehiclePositionsUrl: null, publicTripUpdatesUrl: null, publicAlertsUrl: null, activeSchedule: active, latestCandidate: latest, features: readiness(status), lastRealtimeObservationAt: null, realtimeState: status.settings.realtimePublicationEnabled ? "stale" : "disabled" };
}

function denied(reply: { code(statusCode: number): { send(payload: unknown): unknown } }) { return reply.code(403).send({ data: null, error: { code: "GTFS_ACCESS_DENIED", message: "You do not have access to transit publication settings." } }); }

export function registerGtfsRoutes(app: FastifyInstance, dependencies: RouteDependencies): void {
  app.get<{ Params: { tenantId: string } }>("/v1/tenants/:tenantId/gtfs/publication", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!admitted(context, request.params.tenantId)) return denied(reply);
    if (!dependencies.gtfsPublication) return reply.code(503).send({ data: null, error: { code: "GTFS_UNAVAILABLE", message: "Transit publication is temporarily unavailable." } });
    try {
      const status = await dependencies.gtfsPublication.readStatus(request.params.tenantId);
      return status ? reply.send({ data: statusJson(status), error: null }) : reply.code(404).send({ data: null, error: { code: "GTFS_NOT_CONFIGURED", message: "Transit publication has not been configured for this workspace." } });
    } catch { return reply.code(503).send({ data: null, error: { code: "GTFS_UNAVAILABLE", message: "Transit publication is temporarily unavailable." } }); }
  });

  app.get<{ Params: { tenantId: string; feedVersionId: string } }>("/v1/tenants/:tenantId/gtfs/versions/:feedVersionId/validation", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!admitted(context, request.params.tenantId)) return denied(reply);
    if (!dependencies.gtfsPublication) return reply.code(503).send({ data: null, error: { code: "GTFS_VALIDATION_UNAVAILABLE", message: "Transit validation is temporarily unavailable." } });
    try {
      const issues = await dependencies.gtfsPublication.readValidation({ tenantId: request.params.tenantId, feedVersionId: request.params.feedVersionId });
      if (!issues) return reply.code(404).send({ data: null, error: { code: "GTFS_VERSION_NOT_FOUND", message: "That Schedule version was not found." } });
      const report: GtfsValidationReportResponse["data"] = { feedVersionId: request.params.feedVersionId, issues: issues.map((issue) => ({ code: issue.code, severity: issue.severity, ...(issue.fileName ? { file: issue.fileName } : {}), ...(issue.entityPublicId ? { entityPublicId: issue.entityPublicId } : {}), message: issue.message, ...(issue.suggestedAction ? { suggestedAction: issue.suggestedAction } : {}) })), canPublish: !issues.some((issue) => issue.severity === "error") };
      return reply.send({ data: report, error: null });
    } catch { return reply.code(503).send({ data: null, error: { code: "GTFS_VALIDATION_UNAVAILABLE", message: "Transit validation is temporarily unavailable." } }); }
  });
}
