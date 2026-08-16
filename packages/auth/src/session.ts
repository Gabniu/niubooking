// Ownership: opaque Booking session primitives. Raw tokens are never persisted or logged.

import { createHash, randomBytes } from "node:crypto";
import type { IdentitySubject } from "@bookingapp/domain";

export interface SessionRecord {
  tokenHash: string;
  identity: IdentitySubject;
  userId: string;
  expiresAt: Date;
}

export interface SessionStore {
  save(record: SessionRecord): Promise<void>;
  find(tokenHash: string): Promise<SessionRecord | null>;
  revoke(tokenHash: string): Promise<void>;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionRecord(identity: IdentitySubject, userId: string, ttlSeconds = 3600): {
  token: string;
  record: SessionRecord;
} {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    record: {
      tokenHash: hashSessionToken(token),
      identity,
      userId,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    },
  };
}

export function sessionCookie(token: string, ttlSeconds: number): string {
  return `booking_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ttlSeconds}`;
}

export function clearSessionCookie(): string {
  return "booking_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
}

export function readSessionToken(cookieHeader: string | undefined): string | null {
  const pair = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith("booking_session="));
  if (!pair) return null;
  try {
    const token = decodeURIComponent(pair.slice("booking_session=".length));
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}
