import assert from "node:assert/strict";
import test from "node:test";
import { fetchPackSelection, materializePack, savePackSelection } from "./industry-pack-settings-client.js";

const selection = { tenantId: "tenant-1", packId: "driving-school", packVersion: "1.0.0", overrides: { terminology: { service: "Lesson" } } };
test("loads and saves a tenant pack selection", async () => { const fetcher = async (_url: string, init: { method?: string }) => ({ status: 200, json: async () => ({ data: selection, error: null }) }); assert.equal((await fetchPackSelection(fetcher, "", "tenant-1")).kind, "ready"); assert.equal((await savePackSelection(fetcher, "", { ...selection })).kind, "ready"); });
test("maps tenant pack access denial", async () => { const state = await fetchPackSelection(async () => ({ status: 403, json: async () => ({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "No access" } }) }), "", "tenant-1"); assert.deepEqual(state, { kind: "denied", message: "You do not have access to this workspace." }); });
test("keeps an unconfigured tenant explicit", async () => { const state = await fetchPackSelection(async () => ({ status: 200, json: async () => ({ data: null, error: null }) }), "", "tenant-1"); assert.deepEqual(state, { kind: "empty" }); });
test("maps pack materialization counts", async () => { const state = await materializePack(async () => ({ status: 201, json: async () => ({ data: { createdServices: 1, createdVariants: 1, createdRequirements: 2 }, error: null }) }), "", "tenant-1"); assert.deepEqual(state, { kind: "ready", createdServices: 1, createdVariants: 1, createdRequirements: 2 }); });
