import assert from "node:assert/strict";
import test from "node:test";
import { fetchAuthorizedWorkspaces } from "./workspaces-client.js";

test("loads authorized workspaces without inventing organization names", async () => {
  const state = await fetchAuthorizedWorkspaces(async (url) => ({ ok: true, status: 200, json: async () => ({ data: [{ tenantId: "tenant-1", branchIds: ["branch-1"], role: "owner" }], error: null }), url } as never), "");
  assert.deepEqual(state, { kind: "ready", workspaces: [{ tenantId: "tenant-1", branchIds: ["branch-1"], role: "owner" }] });
});

test("maps an unauthenticated workspace response", async () => {
  const state = await fetchAuthorizedWorkspaces(async () => ({ ok: false, status: 401, json: async () => ({ data: null, error: { code: "UNAUTHENTICATED", message: "Sign in to choose a workspace." } }) }), "");
  assert.deepEqual(state, { kind: "unauthenticated", message: "Please sign in to continue." });
});
