// Ownership: short-lived, one-use PKCE transaction state. A shared store is required before horizontal scaling.

import type { AuthorizationTransaction } from "@bookingapp/auth";

export interface OidcStateRecord extends AuthorizationTransaction {
  redirectUri: string;
  expiresAt: number;
}

export interface OidcStateStore {
  save(record: OidcStateRecord): Promise<void>;
  consume(state: string): Promise<OidcStateRecord | null>;
}

export function createMemoryOidcStateStore(ttlMs = 10 * 60 * 1000): OidcStateStore {
  const records = new Map<string, OidcStateRecord>();
  return {
    async save(record) {
      records.set(record.state, record);
      setTimeout(() => { const current = records.get(record.state); if (current === record) records.delete(record.state); }, ttlMs).unref();
    },
    async consume(state) {
      const record = records.get(state);
      records.delete(state);
      return record && record.expiresAt > Date.now() ? record : null;
    },
  };
}
