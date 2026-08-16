// Ownership: strict NOVA OIDC discovery; provider endpoints are never hardcoded.

import type { OidcConsumerConfig } from "./config.js";

export interface OidcProviderMetadata {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  userinfoEndpoint: string;
  codeChallengeMethods: readonly string[];
}

export type OidcFetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

function httpsEndpoint(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`OIDC discovery is missing ${label}`);
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("OIDC discovery contains an unsafe endpoint");
  return url.toString();
}

export function discoveryUrl(issuer: string): string {
  const url = new URL(issuer);
  return `${url.origin}/.well-known/openid-configuration${url.pathname}`;
}

export async function discoverOidcProvider(config: OidcConsumerConfig, fetcher: OidcFetcher = fetch): Promise<OidcProviderMetadata> {
  const response = await fetcher(discoveryUrl(config.issuer), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("OIDC discovery is unavailable");
  const document = await response.json() as Record<string, unknown>;
  const issuer = httpsEndpoint(document.issuer, "issuer").replace(/\/$/u, "");
  if (issuer !== config.issuer) throw new Error("OIDC discovery issuer mismatch");
  const methods = Array.isArray(document.code_challenge_methods_supported) ? document.code_challenge_methods_supported.filter((value): value is string => typeof value === "string") : [];
  if (!methods.includes("S256")) throw new Error("OIDC provider does not support S256 PKCE");
  return { issuer, authorizationEndpoint: httpsEndpoint(document.authorization_endpoint, "authorization endpoint"), tokenEndpoint: httpsEndpoint(document.token_endpoint, "token endpoint"), jwksUri: httpsEndpoint(document.jwks_uri, "JWKS URI"), userinfoEndpoint: httpsEndpoint(document.userinfo_endpoint, "userinfo endpoint"), codeChallengeMethods: methods };
}
