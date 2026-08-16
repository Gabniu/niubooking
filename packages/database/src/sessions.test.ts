import assert from "node:assert/strict";
import test from "node:test";
import { createDatabaseSessionStore } from "./sessions.js";

test("database session store persists only the opaque token hash and maps rows", async () => {
  const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  const pool = {
    query: async <T>(sql: string, values: readonly unknown[]) => {
      calls.push({ sql, values });
      return { rows: [{ token_hash: "hash-1", identity_issuer: "https://issuer", identity_subject: "sub-1", user_id: "user-1", expires_at: "2026-08-15T12:00:00.000Z" }] as T[] };
    },
  };
  const store = createDatabaseSessionStore(pool as never);
  const expiresAt = new Date("2026-08-15T12:00:00.000Z");
  await store.save({ tokenHash: "hash-1", identity: { issuer: "https://issuer", subject: "sub-1" }, userId: "user-1", expiresAt });
  const record = await store.find("hash-1");
  await store.revoke("hash-1");
  assert.deepEqual(record, { tokenHash: "hash-1", identity: { issuer: "https://issuer", subject: "sub-1" }, userId: "user-1", expiresAt });
  assert.equal(calls.length, 3);
  assert.equal(calls[0]?.values.includes("raw-token"), false);
  assert.match(calls[1]?.sql ?? "", /revoked_at IS NULL/iu);
  assert.match(calls[2]?.sql ?? "", /UPDATE booking_sessions/iu);
});
