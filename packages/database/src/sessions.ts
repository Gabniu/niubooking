// Ownership: PostgreSQL adapter for opaque server-side Booking sessions.

import { Pool } from "pg";

export interface DatabaseSessionRecord {
  tokenHash: string;
  identity: { issuer: string; subject: string };
  userId: string;
  expiresAt: Date;
}

interface SessionRow {
  token_hash: string;
  identity_issuer: string;
  identity_subject: string;
  user_id: string;
  expires_at: Date;
}

export function createDatabaseSessionStore(pool: Pool) {
  return {
    async save(record: DatabaseSessionRecord): Promise<void> {
      await pool.query(
        `INSERT INTO booking_sessions (token_hash, identity_issuer, identity_subject, user_id, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (token_hash) DO UPDATE SET identity_issuer = EXCLUDED.identity_issuer,
           identity_subject = EXCLUDED.identity_subject, user_id = EXCLUDED.user_id,
           expires_at = EXCLUDED.expires_at, revoked_at = NULL`,
        [record.tokenHash, record.identity.issuer, record.identity.subject, record.userId, record.expiresAt],
      );
    },
    async find(tokenHash: string): Promise<DatabaseSessionRecord | null> {
      const result = await pool.query<SessionRow>(
        `SELECT token_hash, identity_issuer, identity_subject, user_id, expires_at
           FROM booking_sessions
          WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
          LIMIT 1`,
        [tokenHash],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        tokenHash: row.token_hash,
        identity: { issuer: row.identity_issuer, subject: row.identity_subject },
        userId: row.user_id,
        expiresAt: new Date(row.expires_at),
      };
    },
    async revoke(tokenHash: string): Promise<void> {
      await pool.query("UPDATE booking_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [tokenHash]);
    },
  };
}
