import assert from "node:assert/strict";
import test from "node:test";
import { bookingChangeAllowed, validateBookingChangePolicy } from "./communications.js";

const policy = { rescheduleEnabled: true, cancellationEnabled: true, minimumNoticeMinutes: 60 };
const now = new Date("2026-08-14T08:00:00Z");

test("allows enabled changes inside the notice window and blocks late changes", () => {
  assert.equal(bookingChangeAllowed(policy, "reschedule", new Date("2026-08-14T09:00:00Z"), now), true);
  assert.equal(bookingChangeAllowed(policy, "cancel", new Date("2026-08-14T08:59:00Z"), now), false);
});

test("validates bounded organization policy values", () => {
  assert.throws(() => validateBookingChangePolicy({ ...policy, minimumNoticeMinutes: 43_201 }), /between 0 and 30 days/);
  assert.equal(bookingChangeAllowed({ ...policy, cancellationEnabled: false }, "cancel", new Date("2026-08-15T08:00:00Z"), now), false);
});
