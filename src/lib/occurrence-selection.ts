import { formatInTimeZone } from "./timezone.ts";

export type OccurrenceSelection = {
  reminder_id: string;
  scheduled_at: string;
  snoozed_until?: string | null;
  status: string;
};

export function selectOccurrenceForDate(
  occurrences: OccurrenceSelection[],
  reminderId: string,
  dateKey: string,
  timezone: string,
): OccurrenceSelection | null {
  return (
    occurrences
      .filter(
        (occurrence) =>
          occurrence.reminder_id === reminderId &&
          formatInTimeZone(occurrence.scheduled_at, timezone, "yyyy-MM-dd") ===
            dateKey,
      )
      .sort((left, right) => {
        const leftAt = new Date(left.snoozed_until ?? left.scheduled_at).getTime();
        const rightAt = new Date(right.snoozed_until ?? right.scheduled_at).getTime();
        return leftAt - rightAt;
      })[0] ?? null
  );
}
