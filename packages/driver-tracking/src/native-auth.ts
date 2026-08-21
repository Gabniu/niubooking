// Ownership: platform-neutral native auth session; secure storage is supplied by the app adapter.

export interface NativeAccessCredential {
  readonly accessToken: string;
  readonly expiresAt: string;
}

export interface NativeAuthStorage {
  read(): Promise<NativeAccessCredential | null>;
  write(credential: NativeAccessCredential): Promise<void>;
  clear(): Promise<void>;
}

export type NativeAuthStatus = "signed_out" | "signed_in" | "expired";

export interface NativeAuthSnapshot {
  readonly status: NativeAuthStatus;
  readonly expiresAt: string | null;
}

export interface NativeAuthSession {
  restore(): Promise<NativeAuthSnapshot>;
  setCredential(credential: NativeAccessCredential): Promise<NativeAuthSnapshot>;
  clear(): Promise<NativeAuthSnapshot>;
  getAccessToken(nowMs?: number): string | null;
  snapshot(): NativeAuthSnapshot;
}

function parseExpiry(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Native auth expiry must be an ISO timestamp");
  return parsed;
}

function validateCredential(credential: NativeAccessCredential, nowMs: number): number {
  if (!credential.accessToken.trim()) throw new Error("Native auth access token is required");
  const expiry = parseExpiry(credential.expiresAt);
  if (expiry <= nowMs) throw new Error("Native auth access token is already expired");
  return expiry;
}

export function createNativeAuthSession(storage: NativeAuthStorage, now: () => number = Date.now): NativeAuthSession {
  let status: NativeAuthStatus = "signed_out";
  let credential: NativeAccessCredential | null = null;

  const snapshot = (): NativeAuthSnapshot => ({ status, expiresAt: credential?.expiresAt ?? null });
  const expireIfNeeded = (nowMs: number): void => {
    if (credential && Date.parse(credential.expiresAt) <= nowMs) status = "expired";
  };

  return {
    async restore() {
      const stored = await storage.read();
      if (!stored) { credential = null; status = "signed_out"; return snapshot(); }
      try {
        validateCredential(stored, now());
        credential = stored;
        status = "signed_in";
        return snapshot();
      } catch {
        credential = null;
        status = "expired";
        await storage.clear();
        return snapshot();
      }
    },
    async setCredential(next) {
      validateCredential(next, now());
      await storage.write(next);
      credential = next;
      status = "signed_in";
      return snapshot();
    },
    async clear() {
      await storage.clear();
      credential = null;
      status = "signed_out";
      return snapshot();
    },
    getAccessToken(nowMs = now()) {
      expireIfNeeded(nowMs);
      return status === "signed_in" && credential ? credential.accessToken : null;
    },
    snapshot,
  };
}
