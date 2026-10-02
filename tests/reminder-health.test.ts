import assert from "node:assert/strict";
import test from "node:test";
import { healthSummary } from "../src/lib/reminder-health.ts";

test("health summary marks failed delivery as attention needed", () => {
  assert.deepEqual(
    healthSummary({ failed_occurrences: 2, stale_occurrences: 0 }),
    { tone: "attention", label: "2 pengiriman perlu diperiksa" },
  );
});

test("health summary marks a clean worker as ready", () => {
  assert.deepEqual(
    healthSummary({ failed_occurrences: 0, stale_occurrences: 0 }),
    { tone: "ready", label: "Pengiriman berjalan normal" },
  );
});
