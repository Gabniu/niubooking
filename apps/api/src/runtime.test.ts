import assert from "node:assert/strict";
import test from "node:test";
import { createDatabaseHealth, createDatabasePublicBookingDependencies, readApiRuntimeConfig } from "./runtime.js";

test("requires database URL and a sufficiently strong hold secret", () => {
  assert.throws(() => readApiRuntimeConfig({ BOOKING_HOLD_SECRET: "x".repeat(32) }), /DATABASE_URL/);
  assert.throws(() => readApiRuntimeConfig({ DATABASE_URL: "postgres://booking", BOOKING_HOLD_SECRET: "short" }), /BOOKING_HOLD_SECRET/);
});

test("reads runtime values without changing or exposing them", () => {
  const config = readApiRuntimeConfig({ DATABASE_URL: "postgres://booking", BOOKING_HOLD_SECRET: "x".repeat(32) });
  assert.deepEqual(config, { databaseUrl: "postgres://booking", bookingHoldSecret: "x".repeat(32) });
});

test("keeps post-confirmation event hooks at the composition boundary", () => {
  const dependencies = createDatabasePublicBookingDependencies({ databaseUrl: "postgres://booking", bookingHoldSecret: "x".repeat(32) }, { onConfirmed: async () => {}, onContactCaptured: async () => {} });
  assert.equal(typeof dependencies.bookingPublic.createHold, "function");
  assert.equal(typeof dependencies.bookingManage.reschedule, "function");
  assert.equal(typeof dependencies.communicationAdmin.read, "function");
  assert.equal(typeof dependencies.communicationAdmin.save, "function");
  assert.equal(typeof dependencies.qrReader.findByPublicCode, "function");
  void dependencies.pool.end();
});

test("database health executes a lightweight query", async () => {
  let statement = "";
  const health = createDatabaseHealth({ query: async (sql: string) => { statement = sql; return { rows: [] }; } } as never);
  assert.equal(await health.check(), true);
  assert.equal(statement, "SELECT 1");
});
