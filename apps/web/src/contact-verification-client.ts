// Ownership: public, single-purpose contact verification client. It never handles a destination.

import type { ContactVerificationResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type ContactVerificationState = { kind: "verified" } | { kind: "invalid" | "expired" | "locked" | "error"; message: string };
export type ContactVerificationFetcher = (url: string, init: { method: "POST"; headers: Record<string, string>; body: string }) => Promise<{ status: number; json(): Promise<unknown> }>;

export async function verifyContactChallenge(fetcher: ContactVerificationFetcher, baseUrl: string, challengeId: string, code: string): Promise<ContactVerificationState> {
  const response = await fetcher(`${baseUrl}/v1/public/contact-verification/${encodeURIComponent(challengeId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
  const body = (await response.json()) as ContactVerificationResponse;
  if (body.data?.verified) return { kind: "verified" };
  if (body.error?.code === "CONTACT_VERIFICATION_EXPIRED") return { kind: "expired", message: userFacingMessage(response.status, body.error, "That code has expired. Request a new code.") };
  if (body.error?.code === "CONTACT_VERIFICATION_LOCKED") return { kind: "locked", message: userFacingMessage(response.status, body.error, "Too many attempts. Request a new code later.") };
  return { kind: response.status >= 500 ? "error" : "invalid", message: userFacingMessage(response.status, body.error, "That verification code is not valid.") };
}
