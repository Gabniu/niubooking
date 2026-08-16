import assert from "node:assert/strict";
import Fastify from "fastify";
import test from "node:test";
import { createAuthorizationTransaction, createSessionRecord, sessionCookie, type OidcProviderMetadata, type OidcTokenResponse, type SessionStore } from "@bookingapp/auth";
import type { IdentitySubject } from "@bookingapp/domain";
import { createMemoryOidcStateStore } from "./oidc-state.js";
import { registerAuthRoutes, type AuthRouteDependencies, type OidcProviderPort } from "./auth-routes.js";

const metadata: OidcProviderMetadata = { issuer: "https://novaauth.niuautomations.com/api/auth", authorizationEndpoint: "https://novaauth.niuautomations.com/api/auth/oauth2/authorize", tokenEndpoint: "https://novaauth.niuautomations.com/api/auth/oauth2/token", jwksUri: "https://novaauth.niuautomations.com/api/auth/jwks", userinfoEndpoint: "https://novaauth.niuautomations.com/api/auth/oauth2/userinfo", codeChallengeMethods: ["S256"] };
const config = { issuer: metadata.issuer, clientId: "booking-client", redirectUri: "https://booking.example.test/auth/callback" };

function provider(identity: IdentitySubject = { issuer: metadata.issuer, subject: "subject-1" }): OidcProviderPort {
  return { discover: async () => metadata, exchange: async (): Promise<OidcTokenResponse> => ({ accessToken: "opaque", idToken: "signed", expiresIn: 300 }), verifyIdToken: async () => identity };
}

function dependencies(overrides: Partial<AuthRouteDependencies> = {}): AuthRouteDependencies {
  const sessions: SessionStore = { save: async () => {}, find: async () => null, revoke: async () => {} };
  return { config, sessions, state: createMemoryOidcStateStore(), readLocalUser: async () => "user-1", provider: provider(), ...overrides };
}

test("auth routes fail closed when OIDC is not configured", async () => {
  const app = Fastify();
  registerAuthRoutes(app);
  const response = await app.inject({ method: "GET", url: "/auth/login" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "AUTH_UNAVAILABLE");
  await app.close();
});

test("session probe reports an authenticated opaque session without exposing identity", async () => {
  const session = createSessionRecord({ issuer: metadata.issuer, subject: "subject-1" }, "user-1");
  const sessions: SessionStore = { save: async () => {}, find: async (hash) => hash === session.record.tokenHash ? session.record : null, revoke: async () => {} };
  const app = Fastify();
  registerAuthRoutes(app, dependencies({ sessions }));
  const response = await app.inject({ method: "GET", url: "/auth/session", headers: { cookie: sessionCookie(session.token, 300) } });
  assert.deepEqual(response.json(), { data: { authenticated: true }, error: null });
  await app.close();
});

test("login creates one-use state and redirects with S256 PKCE", async () => {
  const state = createMemoryOidcStateStore();
  const app = Fastify();
  registerAuthRoutes(app, dependencies({ state }));
  const response = await app.inject({ method: "GET", url: "/auth/login" });
  assert.equal(response.statusCode, 302);
  const query = new URL(response.headers.location ?? "").searchParams;
  assert.equal(query.get("code_challenge_method"), "S256");
  assert.equal(query.get("client_id"), config.clientId);
  assert.equal(query.get("redirect_uri"), config.redirectUri);
  assert.notEqual(query.get("code_challenge"), null);
  assert.notEqual(query.get("verifier"), query.get("code_challenge"));
  assert.notEqual(await state.consume(query.get("state") ?? ""), null);
  assert.equal(await state.consume(query.get("state") ?? ""), null);
  await app.close();
});

test("callback maps an exact local subject, saves an opaque session, and consumes state once", async () => {
  const transaction = { ...createAuthorizationTransaction(), redirectUri: config.redirectUri, expiresAt: Date.now() + 60_000 };
  const state = createMemoryOidcStateStore();
  await state.save(transaction);
  let saved: unknown = null;
  const sessions: SessionStore = { save: async (record) => { saved = record; }, find: async () => null, revoke: async () => {} };
  const app = Fastify();
  registerAuthRoutes(app, dependencies({ state, sessions }));
  const response = await app.inject({ method: "GET", url: `/auth/callback?state=${transaction.state}&code=one-time-code` });
  assert.equal(response.statusCode, 302);
  assert.match(String(response.headers["set-cookie"]), /booking_session=/u);
  assert.equal((saved as { userId: string }).userId, "user-1");
  const replay = await app.inject({ method: "GET", url: `/auth/callback?state=${transaction.state}&code=one-time-code` });
  assert.equal(replay.statusCode, 400);
  await app.close();
});

test("logout revokes the hashed session and clears the cookie", async () => {
  const session = createSessionRecord({ issuer: metadata.issuer, subject: "subject-1" }, "user-1");
  let revoked = "";
  const sessions: SessionStore = { save: async () => {}, find: async () => session.record, revoke: async (hash) => { revoked = hash; } };
  const app = Fastify();
  registerAuthRoutes(app, dependencies({ sessions }));
  const response = await app.inject({ method: "POST", url: "/auth/logout", headers: { cookie: sessionCookie(session.token, 300) } });
  assert.equal(response.statusCode, 200);
  assert.equal(revoked, session.record.tokenHash);
  assert.match(String(response.headers["set-cookie"]), /Max-Age=0/u);
  await app.close();
});
