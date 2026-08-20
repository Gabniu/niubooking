// Ownership: short-lived, tenant-safe cached GTFS-Realtime VehiclePositions bytes.

import type { Pool } from "pg";
import { withPublicTransaction, withTenantTransaction } from "./pg-executor.js";
import type { SqlExecutor } from "./tenant-membership.js";

export interface GtfsRealtimeCacheArtifact {
  scheduleVersion: string;
  payload: Uint8Array;
  sha256: string;
  generatedAt: Date;
  lastObservationAt: Date | null;
  entityCount: number;
}

interface CacheRow {
  schedule_version: string;
  payload: Uint8Array;
  payload_sha256: string;
  generated_at: Date;
  last_observation_at: Date | null;
  entity_count: number;
}

function mapCache(row: CacheRow): GtfsRealtimeCacheArtifact {
  return { scheduleVersion: row.schedule_version, payload: new Uint8Array(row.payload), sha256: row.payload_sha256, generatedAt: new Date(row.generated_at), lastObservationAt: row.last_observation_at ? new Date(row.last_observation_at) : null, entityCount: Number(row.entity_count) };
}

export async function readCachedGtfsVehiclePositions(pool: Pool, publicSlug: string, now = new Date()): Promise<GtfsRealtimeCacheArtifact | null> {
  if (!publicSlug.trim()) return null;
  return withPublicTransaction(pool, async (executor) => {
    const rows = await executor.query<CacheRow>("SELECT cache.schedule_version, cache.payload, cache.payload_sha256, cache.generated_at, cache.last_observation_at, cache.entity_count FROM gtfs_realtime_vehicle_position_cache cache JOIN gtfs_feed_settings settings ON settings.tenant_id = cache.tenant_id AND settings.public_slug = cache.public_slug JOIN gtfs_feed_versions version ON version.tenant_id = settings.tenant_id AND version.id = settings.active_version_id AND version.version = cache.schedule_version WHERE settings.public_slug = $1 AND settings.schedule_publication_enabled = true AND settings.realtime_publication_enabled = true AND version.status = 'published' AND cache.generated_at > $2 - interval '90 seconds'", [publicSlug, now]);
    return rows[0] ? mapCache(rows[0]) : null;
  });
}

export async function writeCachedGtfsVehiclePositions(pool: Pool, input: { publicSlug: string; scheduleVersion: string; payload: Uint8Array; sha256: string; generatedAt: Date; lastObservationAt: Date | null; entityCount: number }): Promise<boolean> {
  if (!input.publicSlug.trim() || !input.scheduleVersion.trim() || !/^[0-9a-f]{64}$/u.test(input.sha256) || input.payload.length < 1 || input.payload.length > 10 * 1024 * 1024 || !Number.isInteger(input.entityCount) || input.entityCount < 0 || input.entityCount > 100_000) return false;
  const active = await withPublicTransaction(pool, async (executor) => (await executor.query<{ tenant_id: string }>("SELECT settings.tenant_id FROM gtfs_feed_settings settings JOIN gtfs_feed_versions version ON version.tenant_id = settings.tenant_id AND version.id = settings.active_version_id WHERE settings.public_slug = $1 AND settings.schedule_publication_enabled = true AND settings.realtime_publication_enabled = true AND version.status = 'published' AND version.version = $2", [input.publicSlug, input.scheduleVersion]))[0] ?? null);
  if (!active) return false;
  await withTenantTransaction(pool, active.tenant_id, async (executor) => {
    await executor.query("INSERT INTO gtfs_realtime_vehicle_position_cache (tenant_id, public_slug, schedule_version, payload, payload_sha256, generated_at, last_observation_at, entity_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (tenant_id, public_slug) DO UPDATE SET schedule_version = EXCLUDED.schedule_version, payload = EXCLUDED.payload, payload_sha256 = EXCLUDED.payload_sha256, generated_at = EXCLUDED.generated_at, last_observation_at = EXCLUDED.last_observation_at, entity_count = EXCLUDED.entity_count, updated_at = now() WHERE gtfs_realtime_vehicle_position_cache.generated_at < EXCLUDED.generated_at OR gtfs_realtime_vehicle_position_cache.schedule_version <> EXCLUDED.schedule_version", [active.tenant_id, input.publicSlug, input.scheduleVersion, Buffer.from(input.payload), input.sha256, input.generatedAt, input.lastObservationAt, input.entityCount]);
  });
  return true;
}
