import assert from "node:assert/strict";
import test from "node:test";
import { parseIndonesianSchedule } from "../supabase/functions/_shared/schedule-parser.ts";

const now = new Date("2026-10-01T10:03:00.000Z");

test("parses tomorrow morning in the user's timezone", () => {
  const result = parseIndonesianSchedule(
    "besok jam 8 pagi",
    "Asia/Jakarta",
    now,
  );
  assert.equal(result?.toISOString(), "2026-10-02T01:00:00.000Z");
});

test("parses a relative minute duration", () => {
  const result = parseIndonesianSchedule("30 menit lagi", "Asia/Jakarta", now);
  assert.equal(result?.toISOString(), "2026-10-01T10:33:00.000Z");
});

test("does not silently move a past time to tomorrow", () => {
  const result = parseIndonesianSchedule("jam 16:00", "Asia/Jakarta", now);
  assert.equal(result, null);
});

test("parses the next named weekday in the user's timezone", () => {
  const result = parseIndonesianSchedule(
    "jumat jam 19:00",
    "Asia/Jakarta",
    now,
  );
  assert.equal(result?.toISOString(), "2026-10-02T12:00:00.000Z");
});

test("parses an explicit ISO local date", () => {
  const result = parseIndonesianSchedule(
    "2026-10-02 jam 16:00",
    "Asia/Jakarta",
    now,
  );
  assert.equal(result?.toISOString(), "2026-10-02T09:00:00.000Z");
});

test("rejects ambiguous text rather than guessing", () => {
  assert.equal(
    parseIndonesianSchedule("nanti sore", "Asia/Jakarta", now),
    null,
  );
});
