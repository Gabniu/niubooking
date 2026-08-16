// Ownership: tenant-scoped communication settings persistence. Workers consume this adapter.

import { defaultBookingChangePolicy, type CommunicationSettings, type ReminderRule } from "@bookingapp/domain";
import type { SqlExecutor } from "./tenant-membership.js";

interface SettingsRow { tenant_id: string; timezone: string; reminders_enabled: boolean; feedback_enabled: boolean; default_feedback_frequency_days: number; reschedule_enabled?: boolean; cancellation_enabled?: boolean; minimum_change_notice_minutes?: number; }
interface RuleRow { id: string; enabled: boolean; minutes_before: number; channels: ReminderRule["channels"]; quiet_hours_start: string | null; quiet_hours_end: string | null; frequency_cap_hours: number; }

export async function readCommunicationSettings(executor: SqlExecutor, tenantId: string): Promise<CommunicationSettings | null> {
  const settings = await executor.query<SettingsRow>("SELECT tenant_id, timezone, reminders_enabled, feedback_enabled, default_feedback_frequency_days, reschedule_enabled, cancellation_enabled, minimum_change_notice_minutes FROM communication_settings WHERE tenant_id = $1", [tenantId]);
  const row = settings[0];
  if (!row) return null;
  const rules = await executor.query<RuleRow>("SELECT id, enabled, minutes_before, channels, quiet_hours_start, quiet_hours_end, frequency_cap_hours FROM reminder_rules WHERE tenant_id = $1 ORDER BY minutes_before", [tenantId]);
  return { tenantId: row.tenant_id, timezone: row.timezone, remindersEnabled: row.reminders_enabled, feedbackEnabled: row.feedback_enabled, defaultFeedbackFrequencyDays: row.default_feedback_frequency_days, bookingChangePolicy: { rescheduleEnabled: row.reschedule_enabled ?? defaultBookingChangePolicy.rescheduleEnabled, cancellationEnabled: row.cancellation_enabled ?? defaultBookingChangePolicy.cancellationEnabled, minimumNoticeMinutes: row.minimum_change_notice_minutes ?? defaultBookingChangePolicy.minimumNoticeMinutes }, reminderRules: rules.map((rule) => ({ id: rule.id, enabled: rule.enabled, minutesBefore: rule.minutes_before, channels: rule.channels, quietHoursStart: rule.quiet_hours_start, quietHoursEnd: rule.quiet_hours_end, frequencyCapHours: rule.frequency_cap_hours })) };
}

export async function saveCommunicationSettings(executor: SqlExecutor, settings: CommunicationSettings): Promise<void> {
  await executor.query("INSERT INTO communication_settings (tenant_id, timezone, reminders_enabled, feedback_enabled, default_feedback_frequency_days, reschedule_enabled, cancellation_enabled, minimum_change_notice_minutes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (tenant_id) DO UPDATE SET timezone = EXCLUDED.timezone, reminders_enabled = EXCLUDED.reminders_enabled, feedback_enabled = EXCLUDED.feedback_enabled, default_feedback_frequency_days = EXCLUDED.default_feedback_frequency_days, reschedule_enabled = EXCLUDED.reschedule_enabled, cancellation_enabled = EXCLUDED.cancellation_enabled, minimum_change_notice_minutes = EXCLUDED.minimum_change_notice_minutes, updated_at = now()", [settings.tenantId, settings.timezone, settings.remindersEnabled, settings.feedbackEnabled, settings.defaultFeedbackFrequencyDays, settings.bookingChangePolicy.rescheduleEnabled, settings.bookingChangePolicy.cancellationEnabled, settings.bookingChangePolicy.minimumNoticeMinutes]);
  await executor.query("DELETE FROM reminder_rules WHERE tenant_id = $1", [settings.tenantId]);
  for (const rule of settings.reminderRules) {
    await executor.query("INSERT INTO reminder_rules (id, tenant_id, enabled, minutes_before, channels, quiet_hours_start, quiet_hours_end, frequency_cap_hours) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [rule.id, settings.tenantId, rule.enabled, rule.minutesBefore, [...rule.channels], rule.quietHoursStart, rule.quietHoursEnd, rule.frequencyCapHours]);
  }
}
