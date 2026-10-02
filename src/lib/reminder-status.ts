import type { Reminder, ReminderStatus } from "@/lib/types";

export const TERMINAL_REMINDER_STATUSES: readonly ReminderStatus[] = [
  "completed",
  "cancelled",
  "disabled",
];

export const ACTIONABLE_REMINDER_STATUSES: readonly ReminderStatus[] = [
  "active",
  "paused",
];

export function isTerminalReminderStatus(status: ReminderStatus) {
  return TERMINAL_REMINDER_STATUSES.includes(status);
}

export function canCompleteReminder(reminder: Pick<Reminder, "status" | "next_occurrence_id">) {
  return ACTIONABLE_REMINDER_STATUSES.includes(reminder.status) && Boolean(reminder.next_occurrence_id);
}

export function canSnoozeReminder(reminder: Pick<Reminder, "status" | "next_occurrence_id">) {
  return ACTIONABLE_REMINDER_STATUSES.includes(reminder.status) && Boolean(reminder.next_occurrence_id);
}

export function canToggleReminder(status: ReminderStatus) {
  return ACTIONABLE_REMINDER_STATUSES.includes(status);
}

export function getBulkStatusEligibleIds(
  reminders: Array<Pick<Reminder, "id" | "status">>,
  selectedIds: string[],
) {
  return reminders
    .filter(
      (reminder) =>
        selectedIds.includes(reminder.id) &&
        ACTIONABLE_REMINDER_STATUSES.includes(reminder.status),
    )
    .map((reminder) => reminder.id);
}
