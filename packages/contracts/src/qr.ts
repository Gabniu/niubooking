// Ownership: versioned public QR contract shared by API, web, and future Voice attribution.

export interface PublicQrBookingResponse {
  data: {
    publicCode: string;
    tenantId: string;
    branchId: string | null;
    packId: string | null;
    serviceId: string | null;
    campaign: string | null;
  } | null;
  error: { code: "QR_NOT_FOUND" | "QR_INACTIVE" | "QR_EXPIRED"; message: string } | null;
}

export interface QrDestinationSummary {
  publicCode: string;
  tenantId: string;
  branchId: string | null;
  packId: string | null;
  serviceId: string | null;
  campaign: string | null;
  status: "active" | "paused" | "revoked" | "expired";
  expiresAt: string | null;
}

export interface QrDestinationListResponse {
  data: readonly QrDestinationSummary[] | null;
  error: { code: "UNAUTHENTICATED" | "TENANT_ACCESS_DENIED"; message: string } | null;
}

export interface QrDestinationResponse {
  data: QrDestinationSummary | null;
  error: { code: "QR_INVALID" | "QR_ADMIN_UNAVAILABLE" | "TENANT_ACCESS_DENIED"; message: string } | null;
}

export interface QrDestinationStatusResponse {
  data: { publicCode: string; status: "active" | "paused" | "revoked" } | null;
  error: { code: "QR_NOT_FOUND" | "QR_ADMIN_UNAVAILABLE" | "TENANT_ACCESS_DENIED"; message: string } | null;
}

export interface QrDestinationRotateResponse {
  data: QrDestinationSummary | null;
  error: { code: "QR_NOT_FOUND" | "QR_ADMIN_UNAVAILABLE" | "TENANT_ACCESS_DENIED"; message: string } | null;
}

export function publicQrPath(publicCode: string): string {
  return `/v1/public/qr/${encodeURIComponent(publicCode)}`;
}

export function publicQrSuccess(input: PublicQrBookingResponse["data"]): PublicQrBookingResponse {
  return { data: input, error: null };
}

export function publicQrFailure(code: "QR_NOT_FOUND" | "QR_INACTIVE" | "QR_EXPIRED"): PublicQrBookingResponse {
  const message = code === "QR_NOT_FOUND" ? "This booking link is not available." : code === "QR_EXPIRED" ? "This booking link has expired." : "This booking link is temporarily unavailable.";
  return { data: null, error: { code, message } };
}
