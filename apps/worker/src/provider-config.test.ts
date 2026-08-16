import assert from "node:assert/strict";
import test from "node:test";
import { readProviderConfig } from "./provider-config.js";
import { nextRetry } from "./retry-policy.js";

test("loads an HTTPS provider without exposing the secret", () => {
  const config = readProviderConfig({ BOOKING_EMAIL_PROVIDER_ENDPOINT: "https://mail.example/send", BOOKING_EMAIL_PROVIDER_API_KEY: "secret", BOOKING_EMAIL_PROVIDER_TIMEOUT_MS: "5000" }, "email");
  assert.equal(config?.timeoutMs, 5000);
  assert.equal(config?.apiKey, "secret");
});

test("fails closed for partial or insecure configuration", () => {
  assert.throws(() => readProviderConfig({ BOOKING_SMS_PROVIDER_ENDPOINT: "http://sms.example/send", BOOKING_SMS_PROVIDER_API_KEY: "secret" }, "sms"), /HTTPS/);
  assert.throws(() => readProviderConfig({ BOOKING_SMS_PROVIDER_ENDPOINT: "https://sms.example/send" }, "sms"), /requires endpoint and API key/);
});

test("uses bounded exponential retry with a terminal attempt", () => {
  assert.deepEqual(nextRetry(1, 3, 1000), { retry: true, delayMs: 1200, attempt: 2 });
  assert.deepEqual(nextRetry(3, 3, 1000), { retry: false, delayMs: 0, attempt: 3 });
});
