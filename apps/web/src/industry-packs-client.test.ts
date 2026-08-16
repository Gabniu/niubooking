import assert from "node:assert/strict";
import test from "node:test";
import { fetchIndustryPacks } from "./industry-packs-client.js";

test("loads the typed industry pack catalog", async () => { const state = await fetchIndustryPacks(async () => ({ status: 200, json: async () => ({ data: [{ id: "dental", version: "1.0.0", displayName: "Dental", supportedLocales: ["en-KE"], theme: { accent: "#06b6d4", accentSoft: "#ecfeff" }, resourceTypes: [], capabilities: [], serviceTemplates: [] }], error: null }) }), ""); assert.equal(state.kind, "ready"); if (state.kind === "ready") assert.equal(state.packs[0]?.id, "dental"); });
test("maps an unavailable pack catalog", async () => { const state = await fetchIndustryPacks(async () => ({ status: 503, json: async () => ({ data: null, error: { code: "PACKS_UNAVAILABLE", message: "Unavailable" } }) }), ""); assert.deepEqual(state, { kind: "error", message: "Industry options are temporarily unavailable. Please try again." }); });
