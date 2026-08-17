// Ownership: session-probe contract tests. Identity details must never cross this boundary.

import assert from "node:assert/strict";
import test from "node:test";
import { readSessionProbe } from "./auth-session.js";

test("accepts only an explicit authenticated session probe", () => {
  assert.equal(readSessionProbe(200, { data: { authenticated: true }, error: null }), "authenticated");
  assert.equal(readSessionProbe(200, { data: { authenticated: false }, error: null }), "unauthenticated");
  assert.equal(readSessionProbe(200, { data: { user: "secret" }, error: null }), "unauthenticated");
});

test("fails closed for unavailable or malformed session responses", () => {
  assert.equal(readSessionProbe(503, { data: { authenticated: true } }), "unauthenticated");
  assert.equal(readSessionProbe(200, null), "unauthenticated");
  assert.equal(readSessionProbe(200, { data: "true" }), "unauthenticated");
});
