import assert from "node:assert/strict";
import test from "node:test";
import { validateAuditMetadata } from "./audit.js";

test("audit metadata stays small, scalar, and machine-keyed", () => {
  assert.deepEqual(validateAuditMetadata({ from_status: "confirmed", quantity: 1, public_value: null }), []);
  assert.match(validateAuditMetadata({ "Unsafe Key": "value" }).join(";"), /lowercase/iu);
  assert.match(validateAuditMetadata({ nested: { secret: true } }).join(";"), /scalar/iu);
});
