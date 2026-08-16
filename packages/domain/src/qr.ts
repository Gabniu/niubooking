// Ownership: QR destination invariants. Public codes are opaque and never carry tenant data.

export type QrDestinationStatus = "active" | "paused" | "revoked" | "expired";

export interface QrDestination {
  publicCode: string;
  tenantId: string;
  branchId: string | null;
  packId: string | null;
  serviceId: string | null;
  campaign: string | null;
  status: QrDestinationStatus;
  expiresAt: Date | null;
}

export type QrResolution =
  | { ok: true; destination: QrDestination }
  | { ok: false; reason: "not_found" | "inactive" | "expired" };

export interface QrDestinationReader {
  findByPublicCode(publicCode: string): Promise<QrDestination | null>;
}

export function resolveQrDestination(
  reader: QrDestinationReader,
  publicCode: string,
  now = new Date(),
): Promise<QrResolution> {
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(publicCode)) return Promise.resolve({ ok: false, reason: "not_found" });
  return reader.findByPublicCode(publicCode).then((destination) => {
    if (!destination) return { ok: false, reason: "not_found" };
    if (destination.expiresAt && destination.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
    if (destination.status !== "active") return { ok: false, reason: "inactive" };
    return { ok: true, destination };
  });
}
