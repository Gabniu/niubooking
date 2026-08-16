import assert from "node:assert/strict";
import test from "node:test";
import { verifyContactChallenge } from "./contact-verification-client.js";

test("maps a successful public verification", async () => {
  const state = await verifyContactChallenge(async (_url, init) => { assert.equal(init.method, "POST"); return { status: 200, json: async () => ({ data: { verified: true }, error: null }) }; }, "", "challenge-1", "123456");
  assert.deepEqual(state, { kind: "verified" });
});

test("maps expired and invalid verification responses", async () => {
  const expired = await verifyContactChallenge(async () => ({ status: 410, json: async () => ({ data: null, error: { code: "CONTACT_VERIFICATION_EXPIRED", message: "Expired" } }) }), "", "challenge-1", "123456");
  assert.equal(expired.kind, "expired");
  const invalid = await verifyContactChallenge(async () => ({ status: 400, json: async () => ({ data: null, error: { code: "CONTACT_VERIFICATION_INVALID", message: "Invalid" } }) }), "", "challenge-1", "123456");
  assert.equal(invalid.kind, "invalid");
});
