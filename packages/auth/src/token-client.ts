// Ownership: server-only authorization-code exchange. Tokens never enter logs or cookies.

import type { OidcConsumerConfig } from "./config.js";
import type { OidcProviderMetadata, OidcFetcher } from "./discovery.js";

export interface OidcTokenResponse {
  accessToken: string;
  idToken: string;
  expiresIn: number | null;
}

export async function exchangeAuthorizationCode(metadata: OidcProviderMetadata, config: OidcConsumerConfig, code: string, verifier: string, fetcher: OidcFetcher = fetch): Promise<OidcTokenResponse> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code, client_id: config.clientId, redirect_uri: config.redirectUri, code_verifier: verifier });
  const response = await fetcher(metadata.tokenEndpoint, { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("OIDC token exchange failed");
  const payload = await response.json() as Record<string, unknown>;
  if (typeof payload.access_token !== "string" || typeof payload.id_token !== "string") throw new Error("OIDC token response is incomplete");
  const expiresIn = typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in) ? payload.expires_in : null;
  return { accessToken: payload.access_token, idToken: payload.id_token, expiresIn };
}
