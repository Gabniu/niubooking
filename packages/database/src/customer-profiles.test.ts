import assert from "node:assert/strict";
import test from "node:test";
import { createCustomerProfile, listCustomerProfiles, readCustomerProfile, setCustomerProfileStatus, updateCustomerProfile } from "./customer-profiles.js";

const row = { id: "customer-1", tenant_id: "tenant-1", display_name: "Alex Morgan", preferred_locale: "en-KE", timezone: "Africa/Nairobi", status: "active" as const };

test("lists tenant-scoped customer profiles", async () => {
  let parameters: readonly unknown[] = [];
  const profiles = await listCustomerProfiles({ query: async <T>(_sql: string, values: readonly unknown[]) => { parameters = values; return [row] as T[]; } }, "tenant-1");
  assert.equal(profiles[0]?.displayName, "Alex Morgan");
  assert.deepEqual(parameters, ["tenant-1", false]);
});

test("creates a trimmed customer profile", async () => {
  const profile = await createCustomerProfile({ query: async <T>() => [row] as T[] }, { id: "customer-1", tenantId: "tenant-1", displayName: " Alex Morgan " });
  assert.equal(profile.displayName, "Alex Morgan");
});

test("changes customer status only within the tenant", async () => {
  const changed = await setCustomerProfileStatus({ query: async <T>() => [{ id: "customer-1" }] as T[] }, "tenant-1", "customer-1", "archived");
  assert.equal(changed, true);
});

test("reads and updates a customer within the tenant", async () => {
  const executor = { query: async <T>(sql: string) => sql.startsWith("SELECT") ? [row] as T[] : [row] as T[] };
  assert.equal((await readCustomerProfile(executor, "tenant-1", "customer-1"))?.displayName, "Alex Morgan");
  assert.equal((await updateCustomerProfile(executor, { tenantId: "tenant-1", customerId: "customer-1", displayName: " Jamie Lee " }))?.displayName, "Alex Morgan");
});
