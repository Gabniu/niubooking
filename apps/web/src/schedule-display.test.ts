// Ownership: regression tests for human-readable schedule labels.

import assert from "node:assert/strict";
import test from "node:test";
import { customerDisplayName } from "./schedule-display.js";

test("uses the customer name instead of the opaque customer id", () => {
  assert.equal(customerDisplayName("customer-1", { "customer-1": "Amina Otieno" }), "Amina Otieno");
});

test("uses a truthful fallback when a customer name is unavailable", () => {
  assert.equal(customerDisplayName("customer-1", {}), "Customer name unavailable");
});
