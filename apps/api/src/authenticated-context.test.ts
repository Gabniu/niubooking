// Ownership: runtime composition tests prove cookie identity still requires local membership.

import assert from "node:assert/strict";
import test from "node:test";
import { createSessionRecord, sessionCookie, type SessionStore } from "@bookingapp/auth";
import { createAuthenticatedDependencies } from "./authenticated-context.js";

test("resolves a session cookie through the local membership repository", async () => {
  const session = createSessionRecord({ issuer: "https://novaauth.niuautomations.com", subject: "sub-1" }, "user-1");
  const sessions: SessionStore = {
    save: async () => {},
    find: async (hash) => hash === session.record.tokenHash ? session.record : null,
    revoke: async () => {},
  };
  const deps = createAuthenticatedDependencies(sessions, {
    query: async <T>() => [{ user_id: "user-1", tenant_id: "tenant-1", branch_ids: ["branch-1"], role: "owner", status: "active" as const } as T],
  });
  const result = await deps.resolve({ headers: { cookie: sessionCookie(session.token, 3600) }, params: { tenantId: "tenant-1" } } as never);
  assert.equal(result.identity?.subject, "sub-1");
  assert.equal(result.membership?.tenantId, "tenant-1");
});

test("treats a missing cookie as unauthenticated", async () => {
  const deps = createAuthenticatedDependencies({ save: async () => {}, find: async () => null, revoke: async () => {} }, { query: async <T>() => [] as T[] });
  const result = await deps.resolve({ headers: {}, params: { tenantId: "tenant-1" } } as never);
  assert.equal(result.identity, null);
});

test("resolves a native bearer token through verified identity and exact local mapping", async () => {
  const deps = createAuthenticatedDependencies({ save: async () => {}, find: async () => null, revoke: async () => {} }, { query: async <T>() => [{ user_id: "user-1", tenant_id: "tenant-1", branch_ids: ["branch-1"], role: "driver", status: "active" as const } as T] }, undefined, {
    accessTokenVerifier: async (token) => { assert.equal(token, "access-token"); return { issuer: "https://novaauth.niuautomations.com/api/auth", subject: "sub-driver" }; },
    accessTokenUserReader: async (identity) => identity.subject === "sub-driver" ? "user-1" : null,
  });
  const result = await deps.resolve({ headers: { authorization: "Bearer access-token" }, params: { tenantId: "tenant-1" } } as never);
  assert.equal(result.identity?.subject, "sub-driver"); assert.equal(result.membership?.role, "driver");
});

test("fails closed when a bearer token is present but invalid", async () => {
  const deps = createAuthenticatedDependencies({ save: async () => {}, find: async () => null, revoke: async () => {} }, { query: async <T>() => [] as T[] }, undefined, { accessTokenVerifier: async () => { throw new Error("invalid"); }, accessTokenUserReader: async () => "user-1" });
  const result = await deps.resolve({ headers: { authorization: "Bearer invalid" }, params: { tenantId: "tenant-1" } } as never);
  assert.equal(result.identity, null); assert.equal(result.membership, null);
});
