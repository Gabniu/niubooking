// Ownership: authorized GTFS publication readiness and validation routes.

import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { GtfsFeatureReadiness, GtfsPublicationStatus, GtfsValidationReportResponse } from "@bookingapp/contracts";
import { GtfsPublicationCommandError, type GtfsFeedPublicationStatus, type GtfsValidationIssue, type GtfsPublicationAction } from "@bookingapp/database";
import { classifyGtfsRealtimeHealth, readGtfsScheduleReferences, serializeGtfsRealtimeTripUpdates, serializeGtfsRealtimeVehiclePositions, validateGtfsScheduleFiles, type GtfsScheduleFile } from "@bookingapp/domain";
import type { TenantContextRequest } from "./tenant-context-handler.js";
import type { GtfsArtifactStore } from "./gtfs-artifact-store.js";
import { persistGtfsScheduleArtifact } from "./gtfs-artifact-publisher.js";

export interface GtfsPublicationAdmin {
  readStatus(tenantId: string): Promise<GtfsFeedPublicationStatus | null>;
  readValidation(input: { tenantId: string; feedVersionId: string }): Promise<readonly GtfsValidationIssue[] | null>;
  readPublicSchedule?(publicSlug: string): Promise<{ tenantId: string; publicSlug: string; version: string; objectKey: string; sha256: string; publishedAt: Date } | null>;
  readCachedVehiclePositions?(publicSlug: string): Promise<{ scheduleVersion: string; payload: Uint8Array; sha256: string; generatedAt: Date } | null>;
  readPublicVehiclePositions?(publicSlug: string): Promise<import("@bookingapp/domain").GtfsRealtimeVehiclePositionsFeed | null>;
  readPublicTripUpdates?(publicSlug: string): Promise<import("@bookingapp/domain").GtfsRealtimeTripUpdatesFeed | null>;
  artifactStore?: GtfsArtifactStore;
  readScheduleFiles?(input: { tenantId: string; feedVersionId: string }): Promise<readonly GtfsScheduleFile[] | null>;
  recordValidation?(input: { tenantId: string; feedVersionId: string; issues: readonly { code: string; severity: "error" | "warning" | "info"; fileName?: string; entityPublicId?: string; message: string; suggestedAction?: string }[]; scheduleSha256?: string; scheduleObjectKey?: string; scheduleReferences?: import("@bookingapp/domain").GtfsPublishedReferences; actorId?: string | null }): Promise<NonNullable<GtfsFeedPublicationStatus["activeVersion"]>>;
  command?(input: { tenantId: string; feedVersionId: string; action: GtfsPublicationAction; idempotencyKey: string; actorId: string | null }): Promise<NonNullable<GtfsFeedPublicationStatus["activeVersion"]>>;
}

interface RouteDependencies { resolve(request: FastifyRequest<{ Params: { tenantId: string } }>): TenantContextRequest | Promise<TenantContextRequest>; gtfsPublication?: GtfsPublicationAdmin; gtfsArtifactStore?: GtfsArtifactStore; }
const previewRoles = ["owner", "admin", "manager", "dispatcher"] as const;
const commandRoles = ["owner", "admin"] as const;

function admitted(context: TenantContextRequest, tenantId: string): boolean {
  return Boolean(context.identity && context.membership && context.membership.tenantId === tenantId && previewRoles.includes(context.membership.role as typeof previewRoles[number]));
}
function canCommand(context: TenantContextRequest, tenantId: string): boolean { return Boolean(context.identity && context.membership && context.membership.tenantId === tenantId && commandRoles.includes(context.membership.role as typeof commandRoles[number])); }

function counts(value: Readonly<Record<"error" | "warning" | "info", number>> | undefined): Readonly<Record<"error" | "warning" | "info", number>> {
  return value ?? { error: 0, warning: 0, info: 0 };
}

function versionSummary(version: NonNullable<GtfsFeedPublicationStatus["activeVersion"]>, issueCounts: GtfsFeedPublicationStatus["issueCounts"]): NonNullable<GtfsPublicationStatus["activeSchedule"]> {
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
  const feedPath = `/v1/public/gtfs/${encodeURIComponent(status.settings.publicSlug)}`;
  return { organizationId: status.settings.tenantId, publicScheduleUrl: status.settings.schedulePublicationEnabled ? `${feedPath}/schedule.zip` : null, publicVehiclePositionsUrl: status.settings.realtimePublicationEnabled ? `${feedPath}/vehicle-positions.pb` : null, publicTripUpdatesUrl: null, publicAlertsUrl: null, activeSchedule: active, latestCandidate: latest, versions: status.versions.map((version) => versionSummary(version, status.issueCounts)), features: readiness(status), lastRealtimeObservationAt: status.lastRealtimeObservationAt?.toISOString() ?? null, realtimeState: classifyGtfsRealtimeHealth(status.settings.realtimePublicationEnabled, status.lastRealtimeObservationAt, new Date()) };
}

function denied(reply: { code(statusCode: number): { send(payload: unknown): unknown } }) { return reply.code(403).send({ data: null, error: { code: "GTFS_ACCESS_DENIED", message: "You do not have access to transit publication settings." } }); }
function commandStatus(code: string): number { return code === "GTFS_COMMAND_INVALID" ? 400 : code === "GTFS_VERSION_NOT_FOUND" ? 404 : 409; }

export function registerGtfsRoutes(app: FastifyInstance, dependencies: RouteDependencies): void {
  app.get<{ Params: { publicSlug: string } }>("/v1/public/gtfs/:publicSlug/schedule.zip", async (request, reply) => {
    const artifactStore = dependencies.gtfsArtifactStore ?? dependencies.gtfsPublication?.artifactStore;
    if (!dependencies.gtfsPublication?.readPublicSchedule || !artifactStore) return reply.code(503).send({ data: null, error: { code: "GTFS_UNAVAILABLE", message: "This transit feed is temporarily unavailable." } });
    try {
      const metadata = await dependencies.gtfsPublication.readPublicSchedule(request.params.publicSlug);
      if (!metadata) return reply.code(404).send({ data: null, error: { code: "GTFS_NOT_FOUND", message: "This transit feed is not available." } });
      const etag = `"${metadata.sha256}"`; if (request.headers["if-none-match"] === etag) return reply.code(304).header("ETag", etag).send();
      const artifact = await artifactStore.read(metadata.objectKey);
      if (!artifact) return reply.code(503).send({ data: null, error: { code: "GTFS_UNAVAILABLE", message: "This transit feed is temporarily unavailable." } });
      const filename = metadata.version.replace(/[^A-Za-z0-9._-]/gu, "-").slice(0, 80) || "schedule";
      return reply.code(200).header("Content-Type", "application/zip").header("Content-Disposition", `attachment; filename="schedule-${filename}.zip"`).header("Cache-Control", "public, max-age=300, stale-while-revalidate=60").header("ETag", etag).header("Last-Modified", metadata.publishedAt.toUTCString()).send(Buffer.from(artifact));
    } catch { return reply.code(503).send({ data: null, error: { code: "GTFS_UNAVAILABLE", message: "This transit feed is temporarily unavailable." } }); }
  });
  app.get<{ Params: { publicSlug: string } }>("/v1/public/gtfs/:publicSlug/vehicle-positions.pb", async (request, reply) => {
    if (!dependencies.gtfsPublication?.readPublicVehiclePositions && !dependencies.gtfsPublication?.readCachedVehiclePositions) return reply.code(503).send({ data: null, error: { code: "GTFS_REALTIME_UNAVAILABLE", message: "Live vehicle positions are temporarily unavailable." } });
    try {
      const cached = await dependencies.gtfsPublication.readCachedVehiclePositions?.(request.params.publicSlug);
      const feed = cached ? null : await dependencies.gtfsPublication.readPublicVehiclePositions?.(request.params.publicSlug);
      if (!cached && !feed) return reply.code(404).send({ data: null, error: { code: "GTFS_REALTIME_NOT_FOUND", message: "Live vehicle positions are not enabled for this feed." } });
      const payload = Buffer.from(cached?.payload ?? serializeGtfsRealtimeVehiclePositions(feed!));
      const scheduleVersion = cached?.scheduleVersion ?? feed!.scheduleVersion;
      const generatedAt = cached?.generatedAt ?? feed!.generatedAt;
      const etag = `"${cached?.sha256 ?? createHash("sha256").update(payload).digest("hex")}"`;
      if (request.headers["if-none-match"] === etag) return reply.code(304).header("ETag", etag).send();
      return reply.code(200).header("Content-Type", "application/x-protobuf").header("Cache-Control", "public, max-age=15, stale-while-revalidate=15").header("ETag", etag).header("Last-Modified", generatedAt.toUTCString()).header("X-GTFS-Schedule-Version", scheduleVersion).send(payload);
    } catch { return reply.code(503).send({ data: null, error: { code: "GTFS_REALTIME_UNAVAILABLE", message: "Live vehicle positions are temporarily unavailable." } }); }
  });
  app.get<{ Params: { publicSlug: string } }>("/v1/public/gtfs/:publicSlug/trip-updates.pb", async (request, reply) => {
    if (!dependencies.gtfsPublication?.readPublicTripUpdates) return reply.code(503).send({ data: null, error: { code: "GTFS_REALTIME_UNAVAILABLE", message: "Trip updates are not available for this feed yet." } });
    try {
      const feed = await dependencies.gtfsPublication.readPublicTripUpdates(request.params.publicSlug);
      if (!feed) return reply.code(404).send({ data: null, error: { code: "GTFS_REALTIME_NOT_FOUND", message: "Trip updates are not enabled for this feed." } });
      const payload = Buffer.from(serializeGtfsRealtimeTripUpdates(feed));
      const etag = `"${createHash("sha256").update(payload).digest("hex")}"`;
      if (request.headers["if-none-match"] === etag) return reply.code(304).header("ETag", etag).send();
      return reply.code(200).header("Content-Type", "application/x-protobuf").header("Cache-Control", "public, max-age=15, stale-while-revalidate=15").header("ETag", etag).header("Last-Modified", feed.generatedAt.toUTCString()).header("X-GTFS-Schedule-Version", feed.scheduleVersion).send(payload);
    } catch { return reply.code(503).send({ data: null, error: { code: "GTFS_REALTIME_UNAVAILABLE", message: "Trip updates are temporarily unavailable." } }); }
  });
  app.post<{ Params: { tenantId: string; feedVersionId: string } }>("/v1/tenants/:tenantId/gtfs/versions/:feedVersionId/generate", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!canCommand(context, request.params.tenantId)) return denied(reply);
    const publication = dependencies.gtfsPublication;
    if (!publication?.readScheduleFiles || !publication.recordValidation || !publication.artifactStore?.write) return reply.code(503).send({ data: null, error: { code: "GTFS_GENERATION_UNAVAILABLE", message: "Schedule generation is temporarily unavailable." } });
    if (!request.params.feedVersionId.trim() || request.params.feedVersionId.length > 160) return reply.code(400).send({ data: null, error: { code: "GTFS_GENERATION_INVALID", message: "Choose a valid Schedule version." } });
    try {
      const files = await publication.readScheduleFiles({ tenantId: request.params.tenantId, feedVersionId: request.params.feedVersionId.trim() });
      if (!files) return reply.code(404).send({ data: null, error: { code: "GTFS_VERSION_NOT_FOUND", message: "That Schedule version was not found." } });
      const issues = validateGtfsScheduleFiles(files);
      if (issues.some((issue) => issue.severity === "error")) {
        const version = await publication.recordValidation({ tenantId: request.params.tenantId, feedVersionId: request.params.feedVersionId.trim(), issues, actorId: context.mappedUserId });
        return reply.code(422).send({ data: { feedVersion: versionSummary(version, {}) }, error: { code: "GTFS_GENERATION_INVALID", message: "The Schedule needs attention before it can be generated." } });
      }
      const scheduleReferences = readGtfsScheduleReferences(files, request.params.feedVersionId.trim());
      const objectKey = `gtfs/${createHash("sha256").update(`${request.params.tenantId}:${request.params.feedVersionId}`).digest("hex")}.zip`;
      const artifact = await persistGtfsScheduleArtifact(publication.artifactStore, { objectKey, files });
      const version = await publication.recordValidation({ tenantId: request.params.tenantId, feedVersionId: request.params.feedVersionId.trim(), issues, scheduleSha256: artifact.sha256, scheduleObjectKey: artifact.objectKey, scheduleReferences, actorId: context.mappedUserId });
      return reply.send({ data: { feedVersion: versionSummary(version, {}) }, error: null });
    } catch { return reply.code(503).send({ data: null, error: { code: "GTFS_GENERATION_UNAVAILABLE", message: "Schedule generation is temporarily unavailable." } }); }
  });
  app.post<{ Params: { tenantId: string }; Body: { feedVersionId?: string; action?: GtfsPublicationAction; idempotencyKey?: string } }>("/v1/tenants/:tenantId/gtfs/commands", async (request, reply) => {
    const context = await dependencies.resolve(request); if (!canCommand(context, request.params.tenantId)) return denied(reply);
    if (!dependencies.gtfsPublication?.command) return reply.code(503).send({ data: null, error: { code: "GTFS_COMMAND_UNAVAILABLE", message: "Transit publication commands are temporarily unavailable." } });
    const body = request.body; const actions: readonly GtfsPublicationAction[] = ["validate", "publish", "withdraw", "rollback"];
    if (!body?.feedVersionId?.trim() || body.feedVersionId.length > 160 || !body.idempotencyKey?.trim() || body.idempotencyKey.length > 200 || !body.action || !actions.includes(body.action)) return reply.code(400).send({ data: null, error: { code: "GTFS_COMMAND_INVALID", message: "Choose a Schedule version, action, and unique command key." } });
    try {
      const version = await dependencies.gtfsPublication.command({ tenantId: request.params.tenantId, feedVersionId: body.feedVersionId.trim(), action: body.action, idempotencyKey: body.idempotencyKey.trim(), actorId: context.mappedUserId });
      const status = await dependencies.gtfsPublication.readStatus(request.params.tenantId); const countsByVersion = status?.issueCounts ?? {};
      return reply.send({ data: { feedVersion: versionSummary(version, countsByVersion) }, error: null });
    } catch (error) {
      if (error instanceof GtfsPublicationCommandError) return reply.code(commandStatus(error.code)).send({ data: null, error: { code: error.code, message: error.message } });
      return reply.code(503).send({ data: null, error: { code: "GTFS_COMMAND_UNAVAILABLE", message: "Transit publication commands are temporarily unavailable." } });
    }
  });
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
