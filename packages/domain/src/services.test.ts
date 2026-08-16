import assert from "node:assert/strict";
import test from "node:test";
import { validateServiceDefinitionDraft } from "./services.js";

test("accepts a bounded appointment service definition", () => { assert.deepEqual(validateServiceDefinitionDraft({ id: "svc-1", tenantId: "tenant-1", name: "Consultation", bookingMode: "appointment", durationMinutes: 30 }), []); });
test("rejects unsafe service duration, price, and currency", () => { const errors = validateServiceDefinitionDraft({ id: "svc-1", tenantId: "tenant-1", name: "Bad", bookingMode: "appointment", durationMinutes: 2, priceCents: -1, currency: "usd" }); assert.equal(errors.length, 3); });
