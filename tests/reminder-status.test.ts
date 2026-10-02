import assert from "node:assert/strict";
import test from "node:test";
import {
  canCompleteReminder,
  canSnoozeReminder,
  canToggleReminder,
  getBulkStatusEligibleIds,
  isTerminalReminderStatus,
} from "../src/lib/reminder-status.ts";

test("terminal reminders are not actionable", () => {
  assert.equal(isTerminalReminderStatus("completed"), true);
  assert.equal(isTerminalReminderStatus("cancelled"), true);
  assert.equal(isTerminalReminderStatus("disabled"), true);
  assert.equal(canToggleReminder("completed"), false);
  assert.equal(canToggleReminder("cancelled"), false);
  assert.equal(canSnoozeReminder({ status: "completed", next_occurrence_id: "occ-1" }), false);
});

test("completion and snooze require an actionable occurrence", () => {
  assert.equal(canCompleteReminder({ status: "active", next_occurrence_id: "occ-1" }), true);
  assert.equal(canCompleteReminder({ status: "active" }), false);
  assert.equal(canCompleteReminder({ status: "paused", next_occurrence_id: "occ-1" }), true);
  assert.equal(canSnoozeReminder({ status: "active", next_occurrence_id: "occ-1" }), true);
  assert.equal(canSnoozeReminder({ status: "active" }), false);
});

test("bulk pause and resume ignore terminal reminders", () => {
  const reminders = [
    { id: "active", status: "active" as const },
    { id: "paused", status: "paused" as const },
    { id: "done", status: "completed" as const },
    { id: "cancelled", status: "cancelled" as const },
  ];
  assert.deepEqual(
    getBulkStatusEligibleIds(reminders, ["active", "done", "cancelled"]),
    ["active"],
  );
});
