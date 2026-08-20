// Ownership: tenant-safe stable GTFS IDs and atomic feed-version promotion.

import { isValidGtfsPublicId, type GtfsScheduleFeature } from "@bookingapp/domain";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { appendAuditEvent } from "./audit-events.js";
import { executeGtfsPublicationCommand } from "./gtfs-commands.js";
import { readGtfsScheduleFiles } from "./gtfs-source.js";
import { withPublicTransaction, withTenantTransaction } from "./pg-executor.js";
import type { SqlExecutor } from "./tenant-membership.js";

export type GtfsEntityKind = "agency" | "stop" | "route" | "service" | "trip" | "shape" | "vehicle" | "fare" | "area" | "pathway";
export type GtfsFeedVersionStatus = "draft" | "validating" | "ready" | "published" | "failed" | "withdrawn";

export interface GtfsFeedSettings {
  tenantId: string;
  publicSlug: string;
  publisherName: string;
  publisherUrl: string;
  defaultLanguage: string;
  enabledFeatures: readonly GtfsScheduleFeature[];
  schedulePublicationEnabled: boolean;
  realtimePublicationEnabled: boolean;
  activeVersionId: string | null;
}

export interface GtfsFeedVersion {
  id: string;
  tenantId: string;
  version: string;
  status: GtfsFeedVersionStatus;
  createdAt: Date;
  validFrom: string;
  validUntil: string;
  scheduleSha256: string | null;
  scheduleObjectKey: string | null;
  generatedAt: Date | null;
  validatedAt: Date | null;
  publishedAt: Date | null;
}

export interface GtfsValidationIssueDraft {
  code: string;
  severity: "error" | "warning" | "info";
  fileName?: string;
  entityPublicId?: string;
  message: string;
  suggestedAction?: string;
}

export interface GtfsValidationIssue {
  code: string; severity: "error" | "warning" | "info"; fileName: string | null;
  entityPublicId: string | null; message: string; suggestedAction: string | null;
}

export interface GtfsFeedPublicationStatus {
  settings: GtfsFeedSettings;
  activeVersion: GtfsFeedVersion | null;
  latestVersion: GtfsFeedVersion | null;
  versions: readonly GtfsFeedVersion[];
  issueCounts: Readonly<Record<string, Readonly<Record<"error" | "warning" | "info", number>>>>;
}
export interface GtfsPublicScheduleArtifact {
  tenantId: string;
  publicSlug: string;
  version: string;
  objectKey: string;
  sha256: string;
  publishedAt: Date;
}

interface SettingsRow {
  tenant_id: string; public_slug: string; publisher_name: string; publisher_url: string;
  default_language: string; enabled_features: GtfsScheduleFeature[];
  schedule_publication_enabled: boolean; realtime_publication_enabled: boolean;
  active_version_id: string | null;
}
interface VersionRow {
  id: string; tenant_id: string; version: string; status: GtfsFeedVersionStatus;
  valid_from: string; valid_until: string; schedule_sha256: string | null;
  schedule_object_key: string | null; generated_at: Date | null;
  validated_at: Date | null; published_at: Date | null; created_at?: Date;
}

function mapSettings(row: SettingsRow): GtfsFeedSettings {
  return {
    tenantId: row.tenant_id, publicSlug: row.public_slug, publisherName: row.publisher_name,
    publisherUrl: row.publisher_url, defaultLanguage: row.default_language,
    enabledFeatures: row.enabled_features, schedulePublicationEnabled: row.schedule_publication_enabled,
    realtimePublicationEnabled: row.realtime_publication_enabled, activeVersionId: row.active_version_id,
  };
}

function mapVersion(row: VersionRow): GtfsFeedVersion {
  return {
    id: row.id, tenantId: row.tenant_id, version: row.version, status: row.status,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(0),
    validFrom: String(row.valid_from), validUntil: String(row.valid_until),
    scheduleSha256: row.schedule_sha256, scheduleObjectKey: row.schedule_object_key,
    generatedAt: row.generated_at ? new Date(row.generated_at) : null,
    validatedAt: row.validated_at ? new Date(row.validated_at) : null,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
  };
}

function emptyIssueCounts(): { error: number; warning: number; info: number } { return { error: 0, warning: 0, info: 0 }; }

export async function readGtfsFeedPublicationStatus(executor: SqlExecutor, tenantId: string): Promise<GtfsFeedPublicationStatus | null> {
  const settings = await readGtfsFeedSettings(executor, tenantId);
  if (!settings) return null;
  const versions = await executor.query<VersionRow>("SELECT id, tenant_id, version, status, valid_from, valid_until, schedule_sha256, schedule_object_key, generated_at, validated_at, published_at, created_at FROM gtfs_feed_versions WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC", [tenantId]);
  const counts = await executor.query<{ feed_version_id: string; severity: "error" | "warning" | "info"; count: string }>("SELECT feed_version_id, severity, count(*)::text AS count FROM gtfs_validation_issues WHERE tenant_id = $1 GROUP BY feed_version_id, severity", [tenantId]);
  const issueCounts: Record<string, { error: number; warning: number; info: number }> = {};
  for (const version of versions) issueCounts[version.id] = emptyIssueCounts();
  for (const issue of counts) { const target = issueCounts[issue.feed_version_id] ?? emptyIssueCounts(); target[issue.severity] = Number(issue.count); issueCounts[issue.feed_version_id] = target; }
  const activeVersion = versions.find((version) => version.id === settings.activeVersionId) ?? null;
  return { settings, activeVersion: activeVersion ? mapVersion(activeVersion) : null, latestVersion: versions[0] ? mapVersion(versions[0]) : null, versions: versions.map(mapVersion), issueCounts };
}

export async function readGtfsValidationIssues(executor: SqlExecutor, input: { tenantId: string; feedVersionId: string }): Promise<readonly GtfsValidationIssue[] | null> {
  const version = await executor.query<{ id: string }>("SELECT id FROM gtfs_feed_versions WHERE tenant_id = $1 AND id = $2", [input.tenantId, input.feedVersionId]);
  if (!version[0]) return null;
  return executor.query<GtfsValidationIssue>("SELECT code, severity, file_name, entity_public_id, message, suggested_action FROM gtfs_validation_issues WHERE tenant_id = $1 AND feed_version_id = $2 ORDER BY issue_index", [input.tenantId, input.feedVersionId]);
}

export async function readGtfsPublicSchedule(executor: SqlExecutor, publicSlug: string): Promise<GtfsPublicScheduleArtifact | null> {
  const rows = await executor.query<{ tenant_id: string; public_slug: string; version: string; schedule_object_key: string; schedule_sha256: string; published_at: Date }>(
    "SELECT settings.tenant_id, settings.public_slug, version.version, version.schedule_object_key, version.schedule_sha256, version.published_at FROM gtfs_feed_settings settings JOIN gtfs_feed_versions version ON version.tenant_id = settings.tenant_id AND version.id = settings.active_version_id WHERE settings.public_slug = $1 AND settings.schedule_publication_enabled = true AND version.status = 'published' AND version.schedule_object_key IS NOT NULL AND version.schedule_sha256 IS NOT NULL AND version.published_at IS NOT NULL",
    [publicSlug],
  );
  const row = rows[0];
  return row ? { tenantId: row.tenant_id, publicSlug: row.public_slug, version: row.version, objectKey: row.schedule_object_key, sha256: row.schedule_sha256, publishedAt: new Date(row.published_at) } : null;
}

export async function reserveGtfsPublicId(executor: SqlExecutor, input: {
  tenantId: string; entityKind: GtfsEntityKind; internalId: string; publicId: string;
}): Promise<string> {
  if (!input.internalId.trim() || !isValidGtfsPublicId(input.publicId)) throw new Error("Choose a valid stable public GTFS ID");
  const rows = await executor.query<{ public_id: string }>(
    "INSERT INTO gtfs_public_id_mappings (tenant_id, entity_kind, internal_id, public_id) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, entity_kind, internal_id) DO UPDATE SET internal_id = EXCLUDED.internal_id RETURNING public_id",
    [input.tenantId, input.entityKind, input.internalId, input.publicId],
  );
  if (!rows[0]) throw new Error("GTFS public ID could not be reserved");
  return rows[0].public_id;
}

export async function readGtfsFeedSettings(executor: SqlExecutor, tenantId: string): Promise<GtfsFeedSettings | null> {
  const rows = await executor.query<SettingsRow>(
    "SELECT tenant_id, public_slug, publisher_name, publisher_url, default_language, enabled_features, schedule_publication_enabled, realtime_publication_enabled, active_version_id FROM gtfs_feed_settings WHERE tenant_id = $1",
    [tenantId],
  );
  return rows[0] ? mapSettings(rows[0]) : null;
}

export async function saveGtfsFeedSettings(executor: SqlExecutor, input: GtfsFeedSettings): Promise<GtfsFeedSettings> {
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/u.test(input.publicSlug)) throw new Error("Public feed address is invalid");
  if (!input.publisherName.trim() || !URL.canParse(input.publisherUrl)) throw new Error("Feed publisher details are invalid");
  if (!input.enabledFeatures.includes("core")) throw new Error("The core Schedule feature must stay enabled");
  const rows = await executor.query<SettingsRow>(
    "INSERT INTO gtfs_feed_settings (tenant_id, public_slug, publisher_name, publisher_url, default_language, enabled_features, schedule_publication_enabled, realtime_publication_enabled) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (tenant_id) DO UPDATE SET public_slug = EXCLUDED.public_slug, publisher_name = EXCLUDED.publisher_name, publisher_url = EXCLUDED.publisher_url, default_language = EXCLUDED.default_language, enabled_features = EXCLUDED.enabled_features, schedule_publication_enabled = EXCLUDED.schedule_publication_enabled, realtime_publication_enabled = EXCLUDED.realtime_publication_enabled, updated_at = now() RETURNING tenant_id, public_slug, publisher_name, publisher_url, default_language, enabled_features, schedule_publication_enabled, realtime_publication_enabled, active_version_id",
    [input.tenantId, input.publicSlug, input.publisherName.trim(), input.publisherUrl, input.defaultLanguage, input.enabledFeatures, input.schedulePublicationEnabled, input.realtimePublicationEnabled],
  );
  if (!rows[0]) throw new Error("GTFS feed settings could not be saved");
  return mapSettings(rows[0]);
}

export async function createGtfsFeedVersion(executor: SqlExecutor, input: {
  id?: string; tenantId: string; version: string; validFrom: string; validUntil: string; actorId?: string;
}): Promise<GtfsFeedVersion> {
  if (!input.version.trim() || !/^\d{4}-\d{2}-\d{2}$/u.test(input.validFrom)
    || !/^\d{4}-\d{2}-\d{2}$/u.test(input.validUntil) || input.validUntil < input.validFrom) {
    throw new Error("Feed version and validity dates are invalid");
  }
  const id = input.id ?? randomUUID();
  const rows = await executor.query<VersionRow>(
    "INSERT INTO gtfs_feed_versions (id, tenant_id, version, valid_from, valid_until, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, tenant_id, version, status, valid_from, valid_until, schedule_sha256, schedule_object_key, generated_at, validated_at, published_at",
    [id, input.tenantId, input.version.trim(), input.validFrom, input.validUntil, input.actorId ?? null],
  );
  if (!rows[0]) throw new Error("GTFS feed version could not be created");
  return mapVersion(rows[0]);
}

export async function recordGtfsValidation(executor: SqlExecutor, input: {
  tenantId: string; feedVersionId: string; issues: readonly GtfsValidationIssueDraft[];
  scheduleSha256?: string; scheduleObjectKey?: string; actorId?: string | null;
}): Promise<GtfsFeedVersion> {
  if (input.scheduleSha256 && !/^[0-9a-f]{64}$/u.test(input.scheduleSha256)) throw new Error("Schedule digest is invalid");
  await executor.query("DELETE FROM gtfs_validation_issues WHERE tenant_id = $1 AND feed_version_id = $2", [input.tenantId, input.feedVersionId]);
  for (const [index, issue] of input.issues.entries()) {
    await executor.query(
      "INSERT INTO gtfs_validation_issues (tenant_id, feed_version_id, issue_index, code, severity, file_name, entity_public_id, message, suggested_action) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [input.tenantId, input.feedVersionId, index, issue.code, issue.severity, issue.fileName ?? null, issue.entityPublicId ?? null, issue.message, issue.suggestedAction ?? null],
    );
  }
  const status: GtfsFeedVersionStatus = input.issues.some(({ severity }) => severity === "error") ? "failed" : "ready";
  const rows = await executor.query<VersionRow>(
    "UPDATE gtfs_feed_versions SET status = $3, schedule_sha256 = $4, schedule_object_key = $5, generated_at = now(), validated_at = now() WHERE tenant_id = $1 AND id = $2 AND status IN ('draft','validating','failed','ready') RETURNING id, tenant_id, version, status, valid_from, valid_until, schedule_sha256, schedule_object_key, generated_at, validated_at, published_at",
    [input.tenantId, input.feedVersionId, status, input.scheduleSha256 ?? null, input.scheduleObjectKey ?? null],
  );
  if (!rows[0]) throw new Error("GTFS feed version is unavailable for validation");
  await appendAuditEvent(executor, { tenantId: input.tenantId, actorType: input.actorId ? "user" : "system", actorId: input.actorId ?? null, action: "gtfs.feed_generated", entityType: "gtfs_feed_version", entityId: input.feedVersionId, metadata: { issue_count: input.issues.length, blocking_issue_count: input.issues.filter((issue) => issue.severity === "error").length, artifact_written: Boolean(input.scheduleObjectKey && input.scheduleSha256) } });
  return mapVersion(rows[0]);
}

export async function publishGtfsFeedVersion(executor: SqlExecutor, input: {
  tenantId: string; feedVersionId: string; actorId: string | null;
}): Promise<GtfsFeedVersion> {
  const settings = await executor.query<{ active_version_id: string | null }>("SELECT active_version_id FROM gtfs_feed_settings WHERE tenant_id = $1 FOR UPDATE", [input.tenantId]);
  if (!settings[0]) throw new Error("Configure the public GTFS feed before publishing");
  const rows = await executor.query<VersionRow>(
    "UPDATE gtfs_feed_versions SET status = 'published', published_at = COALESCE(published_at, now()) WHERE tenant_id = $1 AND id = $2 AND status IN ('ready','published') AND schedule_sha256 IS NOT NULL AND schedule_object_key IS NOT NULL RETURNING id, tenant_id, version, status, valid_from, valid_until, schedule_sha256, schedule_object_key, generated_at, validated_at, published_at",
    [input.tenantId, input.feedVersionId],
  );
  if (!rows[0]) throw new Error("Validate a complete GTFS feed before publishing");
  await executor.query("UPDATE gtfs_feed_settings SET active_version_id = $2, schedule_publication_enabled = true, updated_at = now() WHERE tenant_id = $1", [input.tenantId, input.feedVersionId]);
  await appendAuditEvent(executor, { tenantId: input.tenantId, actorType: input.actorId ? "user" : "system", actorId: input.actorId, action: "gtfs.feed_published", entityType: "gtfs_feed_version", entityId: input.feedVersionId, metadata: { previous_version_id: settings[0].active_version_id } });
  return mapVersion(rows[0]);
}

export function createDatabaseGtfsPublication(pool: Pool) {
  return {
    readSettings: (tenantId: string) => withTenantTransaction(pool, tenantId, (executor) => readGtfsFeedSettings(executor, tenantId)),
    readStatus: (tenantId: string) => withTenantTransaction(pool, tenantId, (executor) => readGtfsFeedPublicationStatus(executor, tenantId)),
    readValidation: (input: { tenantId: string; feedVersionId: string }) => withTenantTransaction(pool, input.tenantId, (executor) => readGtfsValidationIssues(executor, input)),
    readScheduleFiles: (input: { tenantId: string; feedVersionId: string }) => withTenantTransaction(pool, input.tenantId, (executor) => readGtfsScheduleFiles(executor, input)),
    recordValidation: (input: { tenantId: string; feedVersionId: string; issues: readonly GtfsValidationIssueDraft[]; scheduleSha256?: string; scheduleObjectKey?: string; actorId?: string | null }) => withTenantTransaction(pool, input.tenantId, (executor) => recordGtfsValidation(executor, input)),
    readPublicSchedule: (publicSlug: string) => withPublicTransaction(pool, (executor) => readGtfsPublicSchedule(executor, publicSlug)),
    publish: (input: { tenantId: string; feedVersionId: string; actorId: string | null }) => withTenantTransaction(pool, input.tenantId, (executor) => publishGtfsFeedVersion(executor, input)),
    command: (input: { tenantId: string; feedVersionId: string; action: import("./gtfs-commands.js").GtfsPublicationAction; idempotencyKey: string; actorId: string | null }) => withTenantTransaction(pool, input.tenantId, (executor) => executeGtfsPublicationCommand(executor, input)),
  };
}
