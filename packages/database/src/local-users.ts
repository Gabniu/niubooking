// Ownership: exact NOVA subject-to-local-user mapping; no email fallback or auto-provisioning.

import { Pool } from "pg";
import type { IdentitySubject } from "@bookingapp/domain";

interface LocalUserRow { id: string; }

export function createLocalUserReader(pool: Pool): (identity: IdentitySubject) => Promise<string | null> {
  return async (identity) => {
    const result = await pool.query<LocalUserRow>(
      `SELECT id FROM local_users WHERE identity_issuer = $1 AND identity_subject = $2 LIMIT 1`,
      [identity.issuer, identity.subject],
    );
    return result.rows[0]?.id ?? null;
  };
}
