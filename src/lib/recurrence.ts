import { formatInTimeZone, fromZonedTime } from "./timezone.ts";

type RecurrenceReminder = {
  schedule_type: "one_time" | "daily" | "weekly" | "monthly";
  start_at: string;
  end_at?: string | null;
  timezone: string;
  recurrence_rule: Record<string, unknown> | null;
};

const weekdayNames = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function getNextOccurrence(
  reminder: RecurrenceReminder,
  after: Date | string = reminder.start_at,
): string | null {
  if (reminder.schedule_type === "one_time" || !reminder.recurrence_rule)
    return null;
  const rule = reminder.recurrence_rule;
  const time = rule.time;
  if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) return null;

  const afterDate = new Date(after);
  if (Number.isNaN(afterDate.getTime())) return null;
  const afterDay = formatInTimeZone(afterDate, reminder.timezone, "yyyy-MM-dd");
  const firstLocalDay = new Date(`${afterDay}T12:00:00Z`);
  const weeklyDays = Array.isArray(rule.days)
    ? rule.days.filter((day): day is string => typeof day === "string")
    : [];
  const monthDay = Number(rule.day);

  for (let offset = 0; offset <= 370; offset += 1) {
    const candidateDay = new Date(firstLocalDay);
    candidateDay.setUTCDate(candidateDay.getUTCDate() + offset);
    if (
      reminder.schedule_type === "weekly" &&
      !weeklyDays.includes(weekdayNames[candidateDay.getUTCDay()])
    )
      continue;
    if (
      reminder.schedule_type === "monthly" &&
      (!Number.isInteger(monthDay) ||
        monthDay < 1 ||
        monthDay > 31 ||
        candidateDay.getUTCDate() !== monthDay)
    )
      continue;

    const localDate = candidateDay.toISOString().slice(0, 10);
    const candidate = fromZonedTime(
      `${localDate}T${time}:00`,
      reminder.timezone,
    );
    if (candidate <= afterDate) continue;
    if (reminder.end_at && candidate > new Date(reminder.end_at)) return null;
    return candidate.toISOString();
  }
  return null;
}
