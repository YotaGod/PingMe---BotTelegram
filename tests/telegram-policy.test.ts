import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedTelegramUser,
  SNOOZE_OPTIONS,
} from "../supabase/functions/_shared/telegram-policy.ts";

test("missing allowlist rejects users in private mode", () => {
  assert.equal(isAllowedTelegramUser("123", undefined, true), false);
});

test("configured allowlist accepts only exact user IDs", () => {
  assert.equal(isAllowedTelegramUser("123", "123, 456", true), true);
  assert.equal(isAllowedTelegramUser("789", "123, 456", true), false);
});

test("snooze options expose the supported durations", () => {
  assert.deepEqual(SNOOZE_OPTIONS, [5, 10, 30, 60, 1440]);
});
