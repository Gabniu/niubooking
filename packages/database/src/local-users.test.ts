import assert from "node:assert/strict";
import test from "node:test";
import { createLocalUserReader } from "./local-users.js";

test("maps only the exact issuer and subject to a local user", async () => {
  const calls: readonly unknown[][] = [];
  const pool = { query: async <T>(_sql: string, values: readonly unknown[]) => { (calls as unknown[][]).push([...values]); return { rows: [{ id: "user-1" }] as T[] }; } };
  const read = createLocalUserReader(pool as never);
  assert.equal(await read({ issuer: "https://novaauth.niuautomations.com/api/auth", subject: "sub-1" }), "user-1");
  assert.deepEqual(calls[0], ["https://novaauth.niuautomations.com/api/auth", "sub-1"]);
});

test("returns no local user when the subject is not mapped", async () => {
  const pool = { query: async <T>() => ({ rows: [] as T[] }) };
  assert.equal(await createLocalUserReader(pool as never)({ issuer: "https://issuer", subject: "unknown" }), null);
});
