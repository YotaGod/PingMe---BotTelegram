const weekdayIndexes: Record<string, number> = {
  minggu: 0,
  ahad: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  jumaat: 5,
  sabtu: 6,
};

function getZonedParts(value: Date, timezone: string) {
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
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function localDateAtNoon(value: Date, timezone: string) {
  const parts = getZonedParts(value, timezone);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
}

function fromZonedDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
) {
  const localTimestamp = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = localTimestamp;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedParts(new Date(candidate), timezone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const correction = localTimestamp - represented;
    if (correction === 0) break;
    candidate += correction;
  }
  const result = new Date(candidate);
  const actual = getZonedParts(result, timezone);
  if (
    actual.year !== year ||
    actual.month !== month ||
    actual.day !== day ||
    actual.hour !== hour ||
    actual.minute !== minute
  )
    return null;
  return result;
}

export function parseIndonesianSchedule(
  input: string,
  timezone: string,
  now = new Date(),
): Date | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  const relative =
    /^(\d{1,3})\s*(menit|mnt|minute|minutes|jam|hour|hours|hari|days?)\s+lagi$/.exec(
      text,
    );
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const multiplier = /^(menit|mnt|minute|minutes)$/.test(unit)
      ? 60_000
      : /^(jam|hour|hours)$/.test(unit)
        ? 3_600_000
        : 86_400_000;
    if (amount < 1 || amount > 365) return null;
    return new Date(now.getTime() + amount * multiplier);
  }

  const isoDate = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(text);
  const timeText = isoDate ? text.replace(isoDate[0], " ") : text;
  const timeMatch =
    /(?:jam\s*)?(\d{1,2})(?::(\d{2}))?\s*(pagi|siang|sore|malam)?/.exec(
      timeText,
    );
  if (!timeMatch) return null;
  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] ?? 0);
  const meridiem = timeMatch[3];
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pagi") hour = hour === 12 ? 0 : hour;
    else if (meridiem === "siang") hour = hour === 12 ? 12 : hour + 12;
    else if (meridiem === "sore" || meridiem === "malam")
      hour = hour === 12 ? 12 : hour + 12;
  } else if (hour > 23) {
    return null;
  }

  const nowParts = getZonedParts(now, timezone);
  const candidateDate = localDateAtNoon(now, timezone);
  if (isoDate) {
    candidateDate.setUTCFullYear(Number(isoDate[1]));
    candidateDate.setUTCMonth(Number(isoDate[2]) - 1);
    candidateDate.setUTCDate(Number(isoDate[3]));
  } else if (/\blusa\b/.test(text)) {
    candidateDate.setUTCDate(candidateDate.getUTCDate() + 2);
  } else if (/\bbesok\b/.test(text)) {
    candidateDate.setUTCDate(candidateDate.getUTCDate() + 1);
  } else {
    const weekday = Object.entries(weekdayIndexes).find(([name]) =>
      new RegExp(`\\b${name}\\b`).test(text),
    )?.[1];
    if (weekday !== undefined) {
      const todayName = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
      }).format(now);
      const todayIndexes: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      let difference = (weekday - todayIndexes[todayName] + 7) % 7;
      if (difference === 0) {
        const todayAtTime = fromZonedDateTime(
          nowParts.year,
          nowParts.month,
          nowParts.day,
          hour,
          minute,
          timezone,
        );
        if (!todayAtTime || todayAtTime <= now) difference = 7;
      }
      candidateDate.setUTCDate(candidateDate.getUTCDate() + difference);
    }
  }

  const result = fromZonedDateTime(
    candidateDate.getUTCFullYear(),
    candidateDate.getUTCMonth() + 1,
    candidateDate.getUTCDate(),
    hour,
    minute,
    timezone,
  );
  return result && result > now ? result : null;
}
