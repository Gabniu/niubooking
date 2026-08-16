import assert from "node:assert/strict";
import test from "node:test";
import { createService, listServices, setServiceStatus } from "./services.js";

const row = { id: "svc-1", tenant_id: "tenant-1", name: "Consultation", description: null, booking_mode: "appointment" as const, duration_minutes: 30, buffer_before_minutes: 0, buffer_after_minutes: 0, price_cents: null, currency: null, pack_id: null, status: "active" as const };
test("lists, creates, and changes a tenant service", async () => { const executor = { query: async <T>() => [row] as T[] }; assert.equal((await listServices(executor, "tenant-1"))[0]?.name, "Consultation"); assert.equal((await createService(executor, { id: "svc-1", tenantId: "tenant-1", name: "Consultation", bookingMode: "appointment", durationMinutes: 30 })).status, "active"); assert.equal(await setServiceStatus(executor, "tenant-1", "svc-1", "inactive"), true); });
