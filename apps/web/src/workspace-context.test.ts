import assert from "node:assert/strict";
import test from "node:test";
import { loadWorkspaceContext } from "./workspace-context.js";

const fetcher = (responses: unknown[]) => async () => ({ json: async () => responses.shift() });
test("resolves an admitted workspace and its selected pack from typed contracts", async () => {
  const state = await loadWorkspaceContext(fetcher([{ data: { tenantId: "tenant-1", userId: "user-1", role: "manager", branchIds: ["branch-1"] }, error: null }, { data: { tenantId: "tenant-1", packId: "dental", packVersion: "1.0.0", overrides: {} }, error: null }, { data: [{ id: "dental", version: "1.0.0", displayName: "Dental", supportedLocales: ["en-KE"], theme: { accent: "#06b6d4", accentSoft: "#ecfeff" }, navigation: [], dashboards: [], resourceTypes: [], capabilities: [], serviceTemplates: [] }], error: null }]), "https://api.example", "tenant-1");
  assert.equal(state.kind, "ready");
  if (state.kind === "ready") { assert.equal(state.tenantId, "tenant-1"); assert.equal(state.pack?.displayName, "Dental"); }
});
test("maps tenant denial without leaking workspace details", async () => { assert.deepEqual(await loadWorkspaceContext(fetcher([{ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } }]), "", "tenant-2"), { kind: "denied", message: "You do not have access to this workspace." }); });
