// Ownership: Booking's server-side NOVA OIDC login, callback, and logout boundary.

import type { FastifyInstance } from "fastify";
import { createAuthorizationTransaction, createSessionRecord, hashSessionToken, readSessionToken, sessionCookie, clearSessionCookie, validateAuthorizationResponse, verifyIdToken, discoverOidcProvider, exchangeAuthorizationCode, type OidcConsumerConfig, type OidcProviderMetadata, type OidcTokenResponse, type SessionStore } from "@bookingapp/auth";
import type { IdentitySubject } from "@bookingapp/domain";
import type { OidcStateRecord, OidcStateStore } from "./oidc-state.js";

export interface OidcProviderPort {
  discover(config: OidcConsumerConfig): Promise<OidcProviderMetadata>;
  exchange(metadata: OidcProviderMetadata, config: OidcConsumerConfig, code: string, verifier: string): Promise<OidcTokenResponse>;
  verifyIdToken(token: string, metadata: OidcProviderMetadata, clientId: string, nonce: string): Promise<IdentitySubject>;
}

export interface AuthRouteDependencies {
  config: OidcConsumerConfig;
  sessions: SessionStore;
  state: OidcStateStore;
  readLocalUser(identity: IdentitySubject): Promise<string | null>;
  provider?: OidcProviderPort;
}

const networkProvider: OidcProviderPort = {
  discover: discoverOidcProvider,
  exchange: exchangeAuthorizationCode,
  verifyIdToken: (token, metadata, clientId, nonce) => verifyIdToken(token, { issuer: metadata.issuer, audience: clientId, jwksUri: metadata.jwksUri }, nonce),
};

function errorResponse(reply: { code(statusCode: number): { send(payload: unknown): unknown } }, status: number, code: string, message: string): unknown {
  return reply.code(status).send({ data: null, error: { code, message } });
}

function authorizationUrl(metadata: OidcProviderMetadata, config: OidcConsumerConfig, transaction: OidcStateRecord): string {
  const query = new URLSearchParams({ response_type: "code", client_id: config.clientId, redirect_uri: config.redirectUri, scope: "openid profile email", state: transaction.state, nonce: transaction.nonce, code_challenge: transaction.challenge, code_challenge_method: "S256", prompt: "select_account" });
  return `${metadata.authorizationEndpoint}?${query.toString()}`;
}

export function registerAuthRoutes(app: FastifyInstance, dependencies?: AuthRouteDependencies): void {
  app.get("/auth/session", async (request, reply) => {
    if (!dependencies) return errorResponse(reply, 503, "AUTH_UNAVAILABLE", "Sign-in is temporarily unavailable.");
    const token = readSessionToken(request.headers.cookie);
    const session = token ? await dependencies.sessions.find(hashSessionToken(token)) : null;
    return reply.send({ data: { authenticated: Boolean(session && session.expiresAt.getTime() > Date.now()) }, error: null });
  });

  app.get("/auth/login", async (_request, reply) => {
    if (!dependencies) return errorResponse(reply, 503, "AUTH_UNAVAILABLE", "Sign-in is temporarily unavailable.");
    try {
      const provider = dependencies.provider ?? networkProvider;
      const metadata = await provider.discover(dependencies.config);
      const transaction = { ...createAuthorizationTransaction(), redirectUri: dependencies.config.redirectUri, expiresAt: Date.now() + 10 * 60 * 1000 };
      await dependencies.state.save(transaction);
      return reply.redirect(authorizationUrl(metadata, dependencies.config, transaction));
    } catch {
      return errorResponse(reply, 503, "AUTH_UNAVAILABLE", "Sign-in is temporarily unavailable.");
    }
  });

  app.get<{ Querystring: { state?: string; code?: string; error?: string } }>("/auth/callback", async (request, reply) => {
    if (!dependencies) return errorResponse(reply, 503, "AUTH_UNAVAILABLE", "Sign-in is temporarily unavailable.");
    const transaction = request.query.state ? await dependencies.state.consume(request.query.state) : null;
    const validation = validateAuthorizationResponse(request.query.state ?? null, request.query.code ?? null, transaction?.state ?? "");
    if (!validation.valid || request.query.error || !transaction || transaction.expiresAt <= Date.now() || transaction.redirectUri !== dependencies.config.redirectUri) return errorResponse(reply, 400, "AUTH_CALLBACK_INVALID", "That sign-in attempt is no longer valid. Please try again.");
    try {
      const provider = dependencies.provider ?? networkProvider;
      const metadata = await provider.discover(dependencies.config);
      const tokens = await provider.exchange(metadata, dependencies.config, validation.code, transaction!.verifier);
      const identity = await provider.verifyIdToken(tokens.idToken, metadata, dependencies.config.clientId, transaction!.nonce);
      const userId = await dependencies.readLocalUser(identity);
      if (!userId) return errorResponse(reply, 403, "AUTH_ACCESS_DENIED", "Your account is not authorized for Booking.");
      const ttlSeconds = Math.min(3600, Math.max(60, tokens.expiresIn ?? 3600));
      const session = createSessionRecord(identity, userId, ttlSeconds);
      await dependencies.sessions.save(session.record);
      return reply.header("set-cookie", sessionCookie(session.token, ttlSeconds)).redirect("/");
    } catch {
      return errorResponse(reply, 502, "AUTH_UNAVAILABLE", "Sign-in could not be completed. Please try again.");
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    if (dependencies) {
      const token = readSessionToken(request.headers.cookie);
      if (token) await dependencies.sessions.revoke(hashSessionToken(token));
    }
    return reply.header("set-cookie", clearSessionCookie()).send({ data: { signedOut: true }, error: null });
  });
}
