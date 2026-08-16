import assert from "node:assert/strict";
import test from "node:test";
import { readCommunicationSettings, saveCommunicationSettings } from "./communications.js";

const row = { tenant_id: "tenant-1", timezone: "Africa/Nairobi", reminders_enabled: true, feedback_enabled: false, default_feedback_frequency_days: 14 };
const rule = { id: "rule-1", enabled: true, minutes_before: 120, channels: ["sms"] as const, quiet_hours_start: "21:00", quiet_hours_end: "07:00", frequency_cap_hours: 24 };
const reminderRule = { id: "rule-1", enabled: true, minutesBefore: 120, channels: ["sms"] as const, quietHoursStart: "21:00", quietHoursEnd: "07:00", frequencyCapHours: 24 };

test("reads tenant settings and reminder rules", async () => {
  const value = await readCommunicationSettings({ query: async <T>(_sql: string, parameters: readonly unknown[]) => parameters[0] === "tenant-1" && String(_sql).includes("communication_settings") ? [row] as T[] : [rule] as T[] }, "tenant-1");
  assert.equal(value?.reminderRules[0]?.minutesBefore, 120);
  assert.equal(value?.feedbackEnabled, false);
});

test("saves settings and replaces tenant reminder rules", async () => {
  const statements: string[] = [];
  const parameters: unknown[][] = [];
  await saveCommunicationSettings({ query: async <T>(statement: string, values: readonly unknown[]) => { statements.push(statement); parameters.push([...values]); return [] as T[]; } }, { tenantId: "tenant-1", timezone: "UTC", remindersEnabled: true, feedbackEnabled: true, defaultFeedbackFrequencyDays: 30, bookingChangePolicy: { rescheduleEnabled: true, cancellationEnabled: true, minimumNoticeMinutes: 120 }, reminderRules: [reminderRule] });
  assert.match(statements[0] ?? "", /ON CONFLICT \(tenant_id\)/);
  assert.ok(statements.some((statement) => statement.startsWith("DELETE FROM reminder_rules")));
  assert.ok(statements.some((statement) => statement.startsWith("INSERT INTO reminder_rules")));
  assert.deepEqual(parameters.at(-1), ["rule-1", "tenant-1", true, 120, ["sms"], "21:00", "07:00", 24]);
});
