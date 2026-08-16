// Ownership: typed read-only industry pack catalog client.

import type { IndustryPacksResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";
export type PackFetcher = (url: string, init: { credentials: "include" }) => Promise<{ status: number; json(): Promise<unknown> }>;
export type IndustryPacksState = { kind: "ready"; packs: NonNullable<IndustryPacksResponse["data"]> } | { kind: "error"; message: string };
export async function fetchIndustryPacks(fetcher: PackFetcher, baseUrl: string): Promise<IndustryPacksState> { const response = await fetcher(`${baseUrl}/v1/industry-packs`, { credentials: "include" }); const body = (await response.json()) as IndustryPacksResponse; return body.data ? { kind: "ready", packs: body.data } : { kind: "error", message: userFacingMessage(response.status, body.error, "We could not load industry options.") }; }
