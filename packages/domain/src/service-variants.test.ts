import assert from "node:assert/strict";
import test from "node:test";
import { validateServiceRequirementDraft, validateServiceVariantDraft } from "./service-variants.js";

test("accepts an inheriting service variant", () => { assert.deepEqual(validateServiceVariantDraft({ id: "variant-1", tenantId: "tenant-1", serviceId: "service-1", name: "Manual lesson" }), []); });
test("rejects an unsafe service variant override", () => { const errors = validateServiceVariantDraft({ id: "variant-1", tenantId: "tenant-1", serviceId: "service-1", name: "Bad", durationMinutes: 2, currency: "usd" }); assert.equal(errors.length, 2); });
test("requires a capability or resource type for a requirement", () => { const errors = validateServiceRequirementDraft({ id: "requirement-1", tenantId: "tenant-1", serviceId: "service-1", kind: "resource", label: "Instructor" }); assert.equal(errors.length, 1); });
test("accepts a bounded capability requirement", () => { assert.deepEqual(validateServiceRequirementDraft({ id: "requirement-1", tenantId: "tenant-1", serviceId: "service-1", kind: "resource", label: "Instructor", quantity: 1, capabilityKey: "licence.manual" }), []); });
