type DateInput = Date | string | number;

function partsInTimeZone(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (name: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === name)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function formatInTimeZone(
  input: DateInput,
  timezone: string,
  pattern: "yyyy-MM-dd" | "HH:mm" | "d" | "i",
): string {
  const value = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(value.getTime())) throw new RangeError("Invalid date");
  const parts = partsInTimeZone(value, timezone);
  if (pattern === "yyyy-MM-dd")
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  if (pattern === "HH:mm")
    return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  if (pattern === "d") return String(parts.day);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(value);
  const weekdayNumber: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return String(weekdayNumber[weekday]);
}

export function fromZonedTime(localDateTime: string, timezone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    localDateTime,
  );
  if (!match) return new Date(Number.NaN);
  const [, year, month, day, hour, minute, second = "0"] = match;
  const localTimestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  let candidate = localTimestamp;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const zoned = partsInTimeZone(new Date(candidate), timezone);
    const representedTimestamp = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );
    const correction = localTimestamp - representedTimestamp;
    if (correction === 0) break;
    candidate += correction;
  }
  return new Date(candidate);
}

export function timeAfterMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}
