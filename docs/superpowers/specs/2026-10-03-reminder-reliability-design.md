# Reminder Reliability and Personal Workflow Design

## Goal

Make PingMe trustworthy for one private owner by ensuring edited and recurring reminders always use the latest valid occurrence, making Telegram views consistent, and adding the operational controls needed to diagnose and clean delivery data.

## Scope

The first implementation cycle covers occurrence correctness, Telegram privacy, list/date semantics, delivery diagnostics, cleanup controls, snooze choices, templates, bulk actions, and export/import. External delivery providers such as WhatsApp and email remain a later integration because they require provider accounts, secrets, consent, and separate delivery guarantees.

## Decisions

1. PostgreSQL remains the source of truth. Schedule edits and occurrence replacement happen in one security-definer RPC transaction.
2. A reminder has one canonical next actionable occurrence. Historical occurrences remain available for history and diagnostics.
3. `/list` shows all reminders. `/today` shows all statuses scheduled for the owner's local date. `/upcoming` shows active reminders scheduled later today.
4. Telegram access is private by default when an allowlist is configured; production configuration must fail closed if the allowlist is missing.
5. Reliability data is user-scoped. The UI may expose counts and retry/repair actions, but never secrets or provider tokens.
6. Every phase must pass unit tests, typecheck, lint, and build before its own commit and push.

## Success criteria

- Editing a reminder cannot leave an old pending occurrence eligible for delivery.
- Changing a reminder's date, time, timezone, repeat rule, or end date produces the correct next occurrence immediately.
- Telegram and dashboard show the same date/status interpretation for mixed one-time and recurring reminders.
- Failed deliveries can be identified and retried safely without creating duplicate actionable occurrences.
- Private Telegram mode does not silently expose the bot to arbitrary users.
- Data retention and export are user-controlled and preserve active reminders.
- New controls have real behavior, keyboard access, mobile-safe layout, and visible loading/error/empty states.
