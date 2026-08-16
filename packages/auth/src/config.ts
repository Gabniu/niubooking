// Ownership: NOVA OIDC configuration validation. Secrets and token exchange stay server-side.

export interface OidcConsumerConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
}

function normalizeHttpsUrl(raw: string, label: string, allowQuery = false, trimPath = false): string {
  const value = new URL(raw);
  if (value.protocol !== "https:") throw new Error(`${label} must use HTTPS`);
  if (value.username || value.password || value.hash || (!allowQuery && value.search)) throw new Error(`${label} contains unsupported URL parts`);
  if (trimPath) value.pathname = value.pathname.replace(/\/+$/u, "");
  const serialized = value.toString();
  return trimPath ? serialized.replace(/\/$/u, "") : serialized;
}

export function parseOidcConfig(input: Record<string, string | undefined>): OidcConsumerConfig {
  const issuer = input.AUTH_ISSUER?.trim();
  const clientId = input.AUTH_CLIENT_ID?.trim();
  const redirectUri = input.AUTH_REDIRECT_URI?.trim();
  if (!issuer || !clientId || !redirectUri) throw new Error("OIDC configuration is incomplete");
  return { issuer: normalizeHttpsUrl(issuer, "OIDC issuer", false, true), clientId, redirectUri: normalizeHttpsUrl(redirectUri, "OIDC redirect URI", true) };
}

export function parseOptionalOidcConfig(input: Record<string, string | undefined>): OidcConsumerConfig | null {
  const configured = [input.AUTH_ISSUER, input.AUTH_CLIENT_ID, input.AUTH_REDIRECT_URI].some((value) => Boolean(value?.trim()));
  return configured ? parseOidcConfig(input) : null;
}
