import assert from "node:assert/strict";
import test from "node:test";
import { selectOccurrenceForDate } from "../src/lib/occurrence-selection.ts";

test("date selection ignores an older occurrence before choosing today's occurrence", () => {
  const result = selectOccurrenceForDate(
    [
      { reminder_id: "r1", scheduled_at: "2026-10-02T01:00:00.000Z", status: "completed" },
      { reminder_id: "r1", scheduled_at: "2026-10-03T01:00:00.000Z", status: "pending" },
    ],
    "r1",
    "2026-10-03",
    "Asia/Jakarta",
  );
  assert.equal(result?.scheduled_at, "2026-10-03T01:00:00.000Z");
});

test("date selection returns no occurrence when the reminder has no occurrence on that date", () => {
  const result = selectOccurrenceForDate(
    [{ reminder_id: "r1", scheduled_at: "2026-10-02T01:00:00.000Z", status: "completed" }],
    "r1",
    "2026-10-03",
    "Asia/Jakarta",
  );
  assert.equal(result, null);
});
