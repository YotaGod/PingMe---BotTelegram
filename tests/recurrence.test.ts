import assert from "node:assert/strict";
import test from "node:test";
import { getNextOccurrence } from "../src/lib/recurrence.ts";

test("daily reminders retain their local time in Jakarta", () => {
  const next = getNextOccurrence(
    {
      schedule_type: "daily",
      start_at: "2026-10-02T13:00:00.000Z",
      timezone: "Asia/Jakarta",
      recurrence_rule: { frequency: "daily", time: "20:00" },
    },
    "2026-10-02T13:00:00.000Z",
  );
  assert.equal(next, "2026-10-03T13:00:00.000Z");
});

test("weekly reminders can select multiple days", () => {
  const next = getNextOccurrence(
    {
      schedule_type: "weekly",
      start_at: "2026-10-05T01:00:00.000Z",
      timezone: "Asia/Jakarta",
      recurrence_rule: {
        frequency: "weekly",
        days: ["monday", "wednesday"],
        time: "08:00",
      },
    },
    "2026-10-05T01:00:00.000Z",
  );
  assert.equal(next, "2026-10-07T01:00:00.000Z");
});

test("monthly day 31 skips months without that date", () => {
  const next = getNextOccurrence(
    {
      schedule_type: "monthly",
      start_at: "2026-01-31T02:00:00.000Z",
      timezone: "Asia/Jakarta",
      recurrence_rule: { frequency: "monthly", day: 31, time: "09:00" },
    },
    "2026-01-31T02:00:00.000Z",
  );
  assert.equal(next, "2026-03-31T02:00:00.000Z");
});

test("daily reminders follow daylight-saving changes in New York", () => {
  const next = getNextOccurrence(
    {
      schedule_type: "daily",
      start_at: "2026-03-07T14:00:00.000Z",
      timezone: "America/New_York",
      recurrence_rule: { frequency: "daily", time: "09:00" },
    },
    "2026-03-07T14:00:00.000Z",
  );
  assert.equal(next, "2026-03-08T13:00:00.000Z");
});

test("one-time reminders do not generate another occurrence", () => {
  assert.equal(
    getNextOccurrence({
      schedule_type: "one_time",
      start_at: "2026-10-02T13:00:00.000Z",
      timezone: "UTC",
      recurrence_rule: null,
    }),
    null,
  );
});
