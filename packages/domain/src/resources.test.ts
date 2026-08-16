import assert from "node:assert/strict";
import test from "node:test";
import { validateResourceDraft } from "./resources.js";

test("accepts a universal resource draft", () => {
  assert.deepEqual(validateResourceDraft({ id: "room-1", tenantId: "tenant-1", name: "Room 1", resourceType: "room" }), []);
});

test("rejects an incomplete resource draft", () => {
  assert.equal(validateResourceDraft({ id: "", tenantId: "tenant-1", name: " ", resourceType: " " }).length, 3);
});

test("accepts bounded unique resource capabilities", () => {
  assert.deepEqual(validateResourceDraft({ id: "vehicle-1", tenantId: "tenant-1", name: "Manual car", resourceType: "vehicle", capabilities: ["licence.manual"] }), []);
  assert.match(validateResourceDraft({ id: "vehicle-1", tenantId: "tenant-1", name: "Manual car", resourceType: "vehicle", capabilities: ["licence.manual", "licence.manual"] }).join("; "), /unique/iu);
});
