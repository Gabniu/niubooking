import assert from "node:assert/strict";
import test from "node:test";
import { userFacingMessage } from "./user-messages.js";

test("maps technical API codes to simple next-step copy", () => {
  assert.equal(userFacingMessage(409, { code: "BOOKING_CONFLICT" }, "Try again."), "Sorry, that time was just taken. Please choose another time.");
  assert.equal(userFacingMessage(410, { code: "QR_EXPIRED" }, "Try again."), "This booking link has expired.");
  assert.equal(userFacingMessage(500, { code: "UNKNOWN" }, "Appointments could not be loaded."), "Appointments could not be loaded. Please try again.");
});
