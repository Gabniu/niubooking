// Ownership: safe browser interpretation of the opaque Booking session probe.

export type SessionProbeState = "authenticated" | "unauthenticated";

export function readSessionProbe(status: number, body: unknown): SessionProbeState {
  if (status < 200 || status >= 300 || !body || typeof body !== "object") return "unauthenticated";
  const data = (body as { data?: unknown }).data;
  return data && typeof data === "object" && (data as { authenticated?: unknown }).authenticated === true ? "authenticated" : "unauthenticated";
}
