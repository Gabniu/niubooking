// Ownership: NOVA OIDC JWT verifier. Provider proves identity; local admission remains separate.

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { IdentitySubject } from "@bookingapp/domain";

export interface OidcVerifierConfig {
  issuer: string;
  audience: string;
  jwksUri: string;
}

export function validateVerifiedClaims(
  claims: JWTPayload,
  config: Pick<OidcVerifierConfig, "issuer" | "audience">,
): IdentitySubject {
  if (claims.iss !== config.issuer) throw new Error("OIDC issuer mismatch");
  if (typeof claims.sub !== "string" || claims.sub.length === 0) throw new Error("OIDC subject is missing");
  return { issuer: claims.iss, subject: claims.sub };
}

export async function verifyAccessToken(
  token: string,
  config: OidcVerifierConfig,
): Promise<IdentitySubject> {
  if (!token) throw new Error("Bearer token is required");
  const jwks = createRemoteJWKSet(new URL(config.jwksUri));
  const result = await jwtVerify(token, jwks, { issuer: config.issuer, audience: config.audience });
  return validateVerifiedClaims(result.payload, config);
}

export async function verifyIdToken(token: string, config: OidcVerifierConfig, expectedNonce: string): Promise<IdentitySubject> {
  if (!token) throw new Error("OIDC ID token is required");
  const jwks = createRemoteJWKSet(new URL(config.jwksUri));
  const result = await jwtVerify(token, jwks, { issuer: config.issuer, audience: config.audience, clockTolerance: 60 });
  if (result.payload.nonce !== expectedNonce) throw new Error("OIDC nonce mismatch");
  const issuedAt = result.payload.iat;
  const now = Math.floor(Date.now() / 1000);
  if (typeof issuedAt !== "number" || issuedAt > now + 60 || issuedAt < now - 600) throw new Error("OIDC ID token issued-at time is invalid");
  return validateVerifiedClaims(result.payload, config);
}
