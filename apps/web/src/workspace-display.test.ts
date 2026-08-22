// Ownership: regression coverage for progressive-disclosure workspace copy.

import assert from "node:assert/strict";
import test from "node:test";
import { workspaceDisplayName, workspaceReference } from "./workspace-display.js";

test("uses a human label when there is one authorized organization", () => {
  assert.equal(workspaceDisplayName(0, 1), "Your authorized organization");
});

test("numbers multiple organizations without pretending to know their names", () => {
  assert.equal(workspaceDisplayName(1, 2), "Authorized organization 2");
});

test("keeps the tenant value available as a progressive-disclosure reference", () => {
  assert.equal(workspaceReference("tenant-1"), "Workspace reference: tenant-1");
});
