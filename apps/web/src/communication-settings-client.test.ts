import assert from "node:assert/strict";
import test from "node:test";
import { fetchCommunicationSettings, saveCommunicationSettings } from "./communication-settings-client.js";

test("loads organization reminder and feedback settings", async () => {
  const state = await fetchCommunicationSettings(async (_url, init) => { assert.equal(init.credentials, "include"); return { ok: true, status: 200, json: async () => ({ data: { tenantId: "tenant-1", timezone: "UTC", remindersEnabled: true, feedbackEnabled: true, reminderRules: [], defaultFeedbackFrequencyDays: 30 }, error: null }) }; }, "https://booking.example", "tenant-1");
  assert.equal(state.kind, "ready");
});

test("saves settings with tenant-scoped credentials and JSON", async () => {
  const state = await saveCommunicationSettings(async (url, init) => {
    assert.match(url, /tenant-1/);
    assert.equal(init.credentials, "include");
    assert.equal(init.method, "PUT");
    assert.equal(init.headers?.["content-type"], "application/json");
    assert.match(init.body ?? "", /remindersEnabled/);
    return { ok: true, status: 200, json: async () => ({ data: { tenantId: "tenant-1", timezone: "UTC", remindersEnabled: true, feedbackEnabled: true, reminderRules: [], defaultFeedbackFrequencyDays: 30 }, error: null }) };
  }, "https://booking.example", "tenant-1", { timezone: "UTC", remindersEnabled: true, feedbackEnabled: true, reminderRules: [], defaultFeedbackFrequencyDays: 30, bookingChangePolicy: { rescheduleEnabled: true, cancellationEnabled: true, minimumNoticeMinutes: 0 } });
  assert.equal(state.kind, "ready");
});

test("accepts the API's empty successful save response", async () => {
  const state = await saveCommunicationSettings(async () => ({ ok: true, status: 204, json: async () => { throw new Error("204 has no body"); } }), "https://booking.example", "tenant-1", { timezone: "UTC", remindersEnabled: false, feedbackEnabled: true, reminderRules: [], defaultFeedbackFrequencyDays: 30, bookingChangePolicy: { rescheduleEnabled: true, cancellationEnabled: true, minimumNoticeMinutes: 0 } });
  assert.equal(state.kind, "ready");
  if (state.kind === "ready") assert.equal(state.settings.remindersEnabled, false);
});
