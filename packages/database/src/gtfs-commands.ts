// Ownership: idempotent, audited GTFS Schedule lifecycle commands.

import type { GtfsFeedVersion, GtfsFeedVersionStatus } from "./gtfs-publication.js";
import { appendAuditEvent } from "./audit-events.js";
import type { SqlExecutor } from "./tenant-membership.js";

export type GtfsPublicationAction = "validate" | "publish" | "withdraw" | "rollback";
export type GtfsPublicationCommandErrorCode = "GTFS_COMMAND_INVALID" | "GTFS_VERSION_NOT_FOUND" | "GTFS_VALIDATION_REQUIRED" | "GTFS_VERSION_CONFLICT";
export class GtfsPublicationCommandError extends Error { constructor(readonly code: GtfsPublicationCommandErrorCode, message: string) { super(message); } }
interface VersionRow { id: string; tenant_id: string; version: string; status: GtfsFeedVersionStatus; valid_from: string; valid_until: string; schedule_sha256: string | null; schedule_object_key: string | null; generated_at: Date | null; validated_at: Date | null; published_at: Date | null; created_at: Date; }
interface CommandRow { action: GtfsPublicationAction; feed_version_id: string; result_version_id: string | null; }
const versionSql = "id, tenant_id, version, status, valid_from, valid_until, schedule_sha256, schedule_object_key, generated_at, validated_at, published_at, created_at";
function mapVersion(row: VersionRow): GtfsFeedVersion { return { id: row.id, tenantId: row.tenant_id, version: row.version, status: row.status, createdAt: new Date(row.created_at), validFrom: String(row.valid_from), validUntil: String(row.valid_until), scheduleSha256: row.schedule_sha256, scheduleObjectKey: row.schedule_object_key, generatedAt: row.generated_at ? new Date(row.generated_at) : null, validatedAt: row.validated_at ? new Date(row.validated_at) : null, publishedAt: row.published_at ? new Date(row.published_at) : null }; }
function fail(code: GtfsPublicationCommandErrorCode, message: string): never { throw new GtfsPublicationCommandError(code, message); }

async function completedCommand(executor: SqlExecutor, tenantId: string, key: string, action: GtfsPublicationAction, feedVersionId: string): Promise<GtfsFeedVersion | null> {
  const rows = await executor.query<CommandRow>("SELECT action, feed_version_id, result_version_id FROM gtfs_publication_commands WHERE tenant_id = $1 AND idempotency_key = $2", [tenantId, key]);
  const command = rows[0]; if (!command) return null;
  if (command.action !== action || command.feed_version_id !== feedVersionId) fail("GTFS_VERSION_CONFLICT", "That command key was already used for another Schedule action.");
  if (!command.result_version_id) fail("GTFS_VERSION_CONFLICT", "That Schedule action is still being completed. Try again shortly.");
  const versions = await executor.query<VersionRow>(`SELECT ${versionSql} FROM gtfs_feed_versions WHERE tenant_id = $1 AND id = $2`, [tenantId, command.result_version_id]);
  return versions[0] ? mapVersion(versions[0]) : fail("GTFS_VERSION_CONFLICT", "The previous Schedule command result is unavailable.");
}

export async function executeGtfsPublicationCommand(executor: SqlExecutor, input: { tenantId: string; feedVersionId: string; action: GtfsPublicationAction; idempotencyKey: string; actorId: string | null }): Promise<GtfsFeedVersion> {
  if (!input.feedVersionId.trim() || !input.idempotencyKey.trim() || input.idempotencyKey.length > 200) fail("GTFS_COMMAND_INVALID", "A Schedule version and unique command key are required.");
  if (input.action === "validate") fail("GTFS_VALIDATION_REQUIRED", "Validate the generated Schedule artifact before using a lifecycle command.");
  const previous = await completedCommand(executor, input.tenantId, input.idempotencyKey, input.action, input.feedVersionId); if (previous) return previous;
  const settings = await executor.query<{ active_version_id: string | null }>("SELECT active_version_id FROM gtfs_feed_settings WHERE tenant_id = $1 FOR UPDATE", [input.tenantId]);
  if (!settings[0]) fail("GTFS_VERSION_CONFLICT", "Configure the public transit feed before changing publication state.");
  const versions = await executor.query<VersionRow>(`SELECT ${versionSql} FROM gtfs_feed_versions WHERE tenant_id = $1 AND id = $2 FOR UPDATE`, [input.tenantId, input.feedVersionId]);
  const target = versions[0]; if (!target) fail("GTFS_VERSION_NOT_FOUND", "That Schedule version was not found.");
  const claim = await executor.query<{ idempotency_key: string }>("INSERT INTO gtfs_publication_commands (tenant_id, idempotency_key, action, feed_version_id) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, idempotency_key) DO NOTHING RETURNING idempotency_key", [input.tenantId, input.idempotencyKey, input.action, input.feedVersionId]);
  if (!claim[0]) { const retry = await completedCommand(executor, input.tenantId, input.idempotencyKey, input.action, input.feedVersionId); if (retry) return retry; fail("GTFS_VERSION_CONFLICT", "That Schedule action is still being completed. Try again shortly."); }
  const previousId = settings[0].active_version_id;
  if (input.action === "publish") {
    if (!(target.status === "ready" || target.status === "published") || !target.schedule_sha256 || !target.schedule_object_key) fail("GTFS_VALIDATION_REQUIRED", "Only a complete, validated Schedule artifact can be published.");
    await executor.query("UPDATE gtfs_feed_versions SET status = 'published', published_at = COALESCE(published_at, now()) WHERE tenant_id = $1 AND id = $2", [input.tenantId, target.id]);
    await executor.query("UPDATE gtfs_feed_settings SET active_version_id = $2, schedule_publication_enabled = true, updated_at = now() WHERE tenant_id = $1", [input.tenantId, target.id]);
    await appendAuditEvent(executor, { tenantId: input.tenantId, actorType: input.actorId ? "user" : "system", actorId: input.actorId, action: "gtfs.feed_published", entityType: "gtfs_feed_version", entityId: target.id, metadata: { previous_version_id: previousId } });
  } else if (input.action === "withdraw") {
    if (settings[0].active_version_id !== target.id || target.status !== "published") fail("GTFS_VERSION_CONFLICT", "Only the live Schedule can be withdrawn.");
    await executor.query("UPDATE gtfs_feed_versions SET status = 'withdrawn', withdrawn_at = now() WHERE tenant_id = $1 AND id = $2", [input.tenantId, target.id]);
    await executor.query("UPDATE gtfs_feed_settings SET active_version_id = NULL, schedule_publication_enabled = false, updated_at = now() WHERE tenant_id = $1", [input.tenantId]);
    await appendAuditEvent(executor, { tenantId: input.tenantId, actorType: input.actorId ? "user" : "system", actorId: input.actorId, action: "gtfs.feed_withdrawn", entityType: "gtfs_feed_version", entityId: target.id, metadata: {} });
  } else {
    if (!(target.status === "published" || target.status === "withdrawn") || !target.schedule_sha256 || !target.schedule_object_key) fail("GTFS_VERSION_CONFLICT", "Choose a previously published complete Schedule version to roll back to.");
    await executor.query("UPDATE gtfs_feed_versions SET status = 'published', published_at = COALESCE(published_at, now()) WHERE tenant_id = $1 AND id = $2", [input.tenantId, target.id]);
    await executor.query("UPDATE gtfs_feed_settings SET active_version_id = $2, schedule_publication_enabled = true, updated_at = now() WHERE tenant_id = $1", [input.tenantId, target.id]);
    await appendAuditEvent(executor, { tenantId: input.tenantId, actorType: input.actorId ? "user" : "system", actorId: input.actorId, action: "gtfs.feed_rolled_back", entityType: "gtfs_feed_version", entityId: target.id, metadata: { previous_version_id: previousId } });
  }
  const result = await executor.query<VersionRow>(`SELECT ${versionSql} FROM gtfs_feed_versions WHERE tenant_id = $1 AND id = $2`, [input.tenantId, target.id]);
  if (!result[0]) fail("GTFS_VERSION_CONFLICT", "The Schedule command did not produce a version result.");
  await executor.query("UPDATE gtfs_publication_commands SET result_version_id = $3 WHERE tenant_id = $1 AND idempotency_key = $2", [input.tenantId, input.idempotencyKey, target.id]);
  return mapVersion(result[0]);
}
