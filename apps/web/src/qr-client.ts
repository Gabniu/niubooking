// Ownership: frontend public QR client and explicit state mapping for scan landing screens.

import { publicQrPath, type PublicQrBookingResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type PublicQrState =
  | { kind: "ready"; destination: NonNullable<PublicQrBookingResponse["data"]> }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string };

export interface QrFetchLike {
  (input: string): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

export async function fetchPublicQr(fetcher: QrFetchLike, baseUrl: string, publicCode: string): Promise<PublicQrState> {
  const response = await fetcher(`${baseUrl}${publicQrPath(publicCode)}`);
  const body = (await response.json()) as PublicQrBookingResponse;
  if (body.data) return { kind: "ready", destination: body.data };
  if (body.error?.code === "QR_INACTIVE" || body.error?.code === "QR_EXPIRED" || body.error?.code === "QR_NOT_FOUND") return { kind: "unavailable", message: userFacingMessage(response.status, body.error, "This booking link is not available.") };
  if (!response.ok) return { kind: "error", message: userFacingMessage(response.status, body.error, "We could not load this booking link.") };
  return { kind: "error", message: "The booking link could not be loaded." };
}
