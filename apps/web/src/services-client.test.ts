import assert from "node:assert/strict";
import test from "node:test";
import { createService, fetchServices, setServiceStatus } from "./services-client.js";

const service = { id: "svc-1", tenantId: "tenant-1", name: "Consultation", description: null, bookingMode: "appointment" as const, durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, priceCents: null, currency: null, packId: null, status: "active" as const };
test("loads and changes typed tenant services", async () => { const fetcher = async (_url: string, init: { method?: string }) => ({ status: 200, json: async () => init.method === "POST" ? { data: service, error: null } : { data: [service], error: null } }); assert.equal((await fetchServices(fetcher, "", "tenant-1")).kind, "ready"); assert.equal((await createService(fetcher, "", "tenant-1", { name: "Consultation", bookingMode: "appointment", durationMinutes: 30 })).kind, "ready"); assert.equal((await setServiceStatus(fetcher, "", "tenant-1", "svc-1", "inactive")).kind, "ready"); });
test("maps tenant denial without exposing data", async () => { const state = await fetchServices(async () => ({ status: 403, json: async () => ({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "No access" } }) }), "", "tenant-1"); assert.deepEqual(state, { kind: "denied", message: "You do not have access to this workspace." }); });
