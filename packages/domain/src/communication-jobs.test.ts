import assert from "node:assert/strict";
import test from "node:test";
import { communicationIdempotencyKey, shouldSuppressJob } from "./communication-jobs.js";

test("builds a stable tenant-scoped idempotency key", () => {
  assert.equal(communicationIdempotencyKey({ tenantId: "tenant-1", kind: "reminder", customerId: "customer-1", campaignOrRuleId: "rule-1", occurrence: "booking-1" }), "tenant-1:reminder:customer-1:rule-1:booking-1");
});

test("suppresses opted-out, cancelled, missing-contact, and stale jobs", () => {
  const now = new Date("2026-08-12T12:00:00Z");
  assert.equal(shouldSuppressJob({ optedOut: true, bookingCancelled: false, contactAvailable: true, now, scheduledFor: new Date("2026-08-12T13:00:00Z") }), true);
  assert.equal(shouldSuppressJob({ optedOut: false, bookingCancelled: false, contactAvailable: true, now, scheduledFor: new Date("2026-08-12T13:00:00Z") }), false);
});
