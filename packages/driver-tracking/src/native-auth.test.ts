// Ownership: native auth session contract tests; token values must never appear in snapshots.

import assert from "node:assert/strict";
import test from "node:test";
import { createNativeAuthSession, type NativeAccessCredential, type NativeAuthStorage } from "./native-auth.js";

const credential: NativeAccessCredential = { accessToken: "secret-access-token", expiresAt: "2030-01-01T00:10:00.000Z" };

function memoryStorage(initial: NativeAccessCredential | null = null): NativeAuthStorage & { value: NativeAccessCredential | null; clears: number } {
  const state = { value: initial, clears: 0 };
  return {
    get value() { return state.value; },
    get clears() { return state.clears; },
    async read() { return state.value; },
    async write(next) { state.value = next; },
    async clear() { state.value = null; state.clears += 1; },
  };
}

test("restores a valid credential but never exposes the token in a snapshot", async () => {
  const storage = memoryStorage(credential);
  const session = createNativeAuthSession(storage, () => Date.parse("2030-01-01T00:00:00.000Z"));
  assert.deepEqual(await session.restore(), { status: "signed_in", expiresAt: credential.expiresAt });
  assert.equal(session.getAccessToken(), credential.accessToken);
  assert.equal("accessToken" in session.snapshot(), false);
});

test("clears expired persisted credentials and reports an expired state", async () => {
  const storage = memoryStorage({ ...credential, expiresAt: "2029-12-31T23:59:00.000Z" });
  const session = createNativeAuthSession(storage, () => Date.parse("2030-01-01T00:00:00.000Z"));
  assert.deepEqual(await session.restore(), { status: "expired", expiresAt: null });
  assert.equal(storage.clears, 1);
  assert.equal(session.getAccessToken(), null);
});

test("does not persist malformed or already expired credentials", async () => {
  const storage = memoryStorage();
  const session = createNativeAuthSession(storage, () => Date.parse("2030-01-01T00:00:00.000Z"));
  await assert.rejects(() => session.setCredential({ accessToken: "", expiresAt: credential.expiresAt }), /access token is required/u);
  await assert.rejects(() => session.setCredential({ ...credential, expiresAt: "2029-12-31T23:59:00.000Z" }), /already expired/u);
  assert.equal(storage.value, null);
});

test("supports explicit sign-out and expires a token at read time", async () => {
  let current = Date.parse("2030-01-01T00:00:00.000Z");
  const storage = memoryStorage();
  const session = createNativeAuthSession(storage, () => current);
  await session.setCredential(credential);
  current = Date.parse("2030-01-01T00:11:00.000Z");
  assert.equal(session.getAccessToken(), null);
  assert.equal(session.snapshot().status, "expired");
  assert.deepEqual(await session.clear(), { status: "signed_out", expiresAt: null });
  assert.equal(storage.value, null);
});
