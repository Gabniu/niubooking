import assert from "node:assert/strict";
import test from "node:test";
import { issueContactVerificationChallenge, isUsableCommunicationDestination, listCustomerContactMethods, readContactVerificationTarget, resolveCommunicationRecipient, revokeContactVerificationChallenge, upsertCustomerContactMethod, verifyContactMethodChallenge } from "./customer-contact-methods.js";

test("resolves only a verified, consented, non-opted-out destination", async () => {
  let sql = "";
  let parameters: readonly unknown[] = [];
  const destination = await resolveCommunicationRecipient({ query: async <T>(statement: string, values: readonly unknown[]) => { sql = statement; parameters = values; return [{ destination: "+254700000000" }] as T[]; } }, { tenantId: "tenant-1", customerId: "customer-1", channel: "sms" });
  assert.equal(destination, "+254700000000");
  assert.match(sql, /consent_status = 'granted'/);
  assert.match(sql, /NOT EXISTS/);
  assert.deepEqual(parameters, ["tenant-1", "customer-1", "sms"]);
});

test("fails closed for malformed destinations and validates writes", async () => {
  assert.equal(isUsableCommunicationDestination(" +254700000000"), false);
  assert.equal(isUsableCommunicationDestination("bad\nvalue"), false);
  assert.equal(isUsableCommunicationDestination("+254700000000"), true);
  await assert.rejects(() => upsertCustomerContactMethod({ query: async () => [] }, { id: "contact-1", tenantId: "tenant-1", customerId: "customer-1", channel: "sms", destination: "bad\nvalue", consentStatus: "granted", verifiedAt: new Date() }), /invalid/);
});

test("does not return a destination when the repository has no eligible row", async () => {
  const destination = await resolveCommunicationRecipient({ query: async <T>() => [] as T[] }, { tenantId: "tenant-1", customerId: "customer-1", channel: "email" });
  assert.equal(destination, null);
});

test("lists contact methods with masked destinations", async () => {
  const methods = await listCustomerContactMethods({ query: async <T>() => [{ id: "contact-1", customer_id: "customer-1", customer_name: "Alex Morgan", channel: "email", destination: "person@example.test", consent_status: "granted", verified_at: new Date("2026-08-13"), enabled: true, priority: 1 }] as T[] }, "tenant-1");
  assert.equal(methods[0]?.maskedDestination, "p•••@example.test");
  assert.equal(methods[0]?.customerName, "Alex Morgan");
  assert.equal("destination" in (methods[0] ?? {}), false);
});

test("stores only a hashed challenge and verifies a matching code", async () => {
  const statements: string[] = [];
  const executor = { query: async <T>(sql: string) => { statements.push(sql); return [] as T[]; } };
  const challenge = await issueContactVerificationChallenge(executor, { challengeId: "challenge-1", tenantId: "tenant-1", contactMethodId: "contact-1", customerId: "customer-1", channel: "sms", code: "123456", expiresAt: new Date(Date.now() + 60_000) });
  assert.equal(challenge.challengeId, "challenge-1");
  assert.match(statements[1] ?? "", /code_hash/);
  let call = 0;
  const result = await verifyContactMethodChallenge({ query: async <T>(sql: string) => { call += 1; if (call === 1) return [{ tenant_id: "tenant-1", contact_method_id: "contact-1", matches: true }] as T[]; return [] as T[]; } }, { challengeId: "challenge-1", code: "123456" });
  assert.equal(result, "verified");
});

test("rejects malformed verification codes before persistence", async () => {
  await assert.rejects(() => issueContactVerificationChallenge({ query: async <T>() => [] as T[] }, { challengeId: "challenge-1", tenantId: "tenant-1", contactMethodId: "contact-1", customerId: "customer-1", channel: "email", code: "12", expiresAt: new Date(Date.now() + 60_000) }), /six digits/);
});

test("reads only an enabled, consented target for verification delivery", async () => {
  const target = await readContactVerificationTarget({ query: async <T>() => [{ id: "contact-1", tenant_id: "tenant-1", customer_id: "customer-1", channel: "sms", destination: "+254700000000", consent_status: "granted", enabled: true }] as T[] }, "tenant-1", "contact-1");
  assert.equal(target?.destination, "+254700000000");
  const blocked = await readContactVerificationTarget({ query: async <T>() => [{ id: "contact-1", tenant_id: "tenant-1", customer_id: "customer-1", channel: "sms", destination: "+254700000000", consent_status: "unknown", enabled: true }] as T[] }, "tenant-1", "contact-1");
  assert.equal(blocked, null);
});

test("can revoke an undeliverable challenge", async () => {
  let sql = "";
  await revokeContactVerificationChallenge({ query: async <T>(statement: string) => { sql = statement; return [] as T[]; } }, "challenge-1");
  assert.match(sql, /consumed_at = now\(\)/);
});
