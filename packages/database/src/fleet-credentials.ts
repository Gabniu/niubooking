// Ownership: opaque fleet credential formats and one-way secret hashing.

import { createHash } from "node:crypto";

export interface FleetDeviceCredentialParts { readonly tenantId: string; readonly deviceId: string; readonly secret: string; }
export interface FleetSessionCredentialParts { readonly tenantId: string; readonly sessionId: string; readonly secret: string; }

export function credentialHash(secret: string): string { return createHash("sha256").update(secret).digest("hex"); }

function encoded(value: string): string { return Buffer.from(value).toString("base64url"); }
function decoded(part: string): string | null {
  try {
    const value = Buffer.from(part, "base64url").toString("utf8");
    return value && encoded(value) === part ? value : null;
  } catch { return null; }
}

export function decodeFleetDeviceCredential(credential: string): FleetDeviceCredentialParts | null {
  const [prefix, tenantPart, devicePart, secret, ...extra] = credential.split(".");
  if (prefix !== "niu_fleet_v1" || extra.length || !tenantPart || !devicePart || !secret || secret.length < 32) return null;
  const tenantId = decoded(tenantPart); const deviceId = decoded(devicePart);
  return tenantId && deviceId ? { tenantId, deviceId, secret } : null;
}

export function createFleetDeviceCredential(tenantId: string, deviceId: string, secret: string): string {
  return `niu_fleet_v1.${encoded(tenantId)}.${encoded(deviceId)}.${secret}`;
}

export function decodeFleetSessionCredential(credential: string): FleetSessionCredentialParts | null {
  const [prefix, tenantPart, sessionPart, secret, ...extra] = credential.split(".");
  if (prefix !== "niu_traccar_v1" || extra.length || !tenantPart || !sessionPart || !secret || secret.length < 32) return null;
  const tenantId = decoded(tenantPart); const sessionId = decoded(sessionPart);
  return tenantId && sessionId ? { tenantId, sessionId, secret } : null;
}

export function createFleetSessionCredential(tenantId: string, sessionId: string, secret: string): string {
  return `niu_traccar_v1.${encoded(tenantId)}.${encoded(sessionId)}.${secret}`;
}
