import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "./server.js";

const identity = { issuer: "https://novaauth.niuautomations.com", subject: "sub-1" };
const baseResolve = () => ({ identity, mappedUserId: "user-1", membership: null, requestedTenantId: "" });

test("lists only workspaces authorized for the signed-in user", async () => {
  const app = createApiServer({ resolve: baseResolve, resolveIdentity: () => ({ identity, mappedUserId: "user-1" }), workspaceReader: { list: async (userId) => userId === "user-1" ? [{ tenantId: "tenant-1", branchIds: ["branch-1"], role: "owner" }] : [] } });
  const response = await app.inject({ method: "GET", url: "/v1/workspaces" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { data: [{ tenantId: "tenant-1", branchIds: ["branch-1"], role: "owner" }], error: null });
  await app.close();
});

test("does not list workspaces without an authenticated identity", async () => {
  const app = createApiServer({ resolve: baseResolve, resolveIdentity: () => ({ identity: null, mappedUserId: null }), workspaceReader: { list: async () => [] } });
  const response = await app.inject({ method: "GET", url: "/v1/workspaces" });
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json().error, { code: "UNAUTHENTICATED", message: "Sign in to choose a workspace." });
  await app.close();
});

test("maps a workspace repository failure to a retryable response", async () => {
  const app = createApiServer({ resolve: baseResolve, resolveIdentity: () => ({ identity, mappedUserId: "user-1" }), workspaceReader: { list: async () => { throw new Error("database unavailable"); } } });
  const response = await app.inject({ method: "GET", url: "/v1/workspaces" });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json().error, { code: "WORKSPACES_UNAVAILABLE", message: "Your workspaces are temporarily unavailable." });
  await app.close();
});
