import assert from "node:assert/strict";
import test from "node:test";
import { readWorkerRuntimeConfig } from "./runtime-config.js";

test("requires database and HTTPS public URL", () => {
  assert.throws(() => readWorkerRuntimeConfig({ PUBLIC_BASE_URL: "https://booking.test" }), /DATABASE_URL/);
  assert.throws(() => readWorkerRuntimeConfig({ DATABASE_URL: "postgres://booking", PUBLIC_BASE_URL: "http://booking.test" }), /HTTPS/);
});

test("reads configured providers without requiring every channel", () => {
  const config = readWorkerRuntimeConfig({ DATABASE_URL: "postgres://booking", PUBLIC_BASE_URL: "https://booking.test", BOOKING_EMAIL_PROVIDER_ENDPOINT: "https://email.test/send", BOOKING_EMAIL_PROVIDER_API_KEY: "secret", BOOKING_EMAIL_PROVIDER_TIMEOUT_MS: "5000" });
  assert.equal(config.databaseUrl, "postgres://booking");
  assert.equal(config.publicBaseUrl, "https://booking.test/");
  assert.deepEqual(config.providers.map((provider) => provider.channel), ["email"]);
  assert.equal(config.providers[0]?.timeoutMs, 5000);
});

test("allows a not-ready worker with no providers for health reporting", () => {
  const config = readWorkerRuntimeConfig({ DATABASE_URL: "postgres://booking", PUBLIC_BASE_URL: "https://booking.test" });
  assert.deepEqual(config.providers, []);
});
