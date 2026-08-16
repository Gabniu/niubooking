import assert from "node:assert/strict";
import test from "node:test";
import { createContactVerificationIssuer } from "./contact-verification-delivery.js";

const targetRow = { id: "contact-1", tenant_id: "tenant-1", customer_id: "customer-1", channel: "sms" as const, destination: "+254700000000", consent_status: "granted" as const, enabled: true };

test("persists only the challenge hash and sends the code ephemerally", async () => {
  const sent: { kind: string | undefined; code: string | undefined; url: string | undefined } = { kind: undefined, code: undefined, url: undefined };
  const sql: string[] = [];
  const issuer = createContactVerificationIssuer({ query: async <T>(statement: string) => { sql.push(statement); if (statement.startsWith("SELECT id, tenant_id")) return [targetRow] as T[]; return [] as T[]; } }, { send: async ({ job }) => { sent.kind = job.kind; sent.code = job.verificationCode; sent.url = job.verificationUrl; } }, { publicBaseUrl: "https://booking.example", now: () => new Date("2026-08-13T12:00:00Z"), code: () => "123456" });
  const result = await issuer.issue({ tenantId: "tenant-1", contactMethodId: "contact-1" });
  assert.equal(sent.kind, "verification");
  assert.equal(sent.code, "123456");
  assert.match(sent.url ?? "", /challenge=/);
  assert.equal(result.expiresAt.toISOString(), "2026-08-13T12:10:00.000Z");
  assert.match(sql.join("\n"), /code_hash/);
});

test("revokes a challenge when the provider rejects delivery", async () => {
  const sql: string[] = [];
  const issuer = createContactVerificationIssuer({ query: async <T>(statement: string) => { sql.push(statement); if (statement.startsWith("SELECT id, tenant_id")) return [targetRow] as T[]; return [] as T[]; } }, { send: async () => { throw new Error("provider unavailable"); } }, { publicBaseUrl: "https://booking.example", code: () => "123456" });
  await assert.rejects(() => issuer.issue({ tenantId: "tenant-1", contactMethodId: "contact-1" }), /provider unavailable/);
  assert.match(sql.at(-1) ?? "", /consumed_at = now\(\)/);
});
