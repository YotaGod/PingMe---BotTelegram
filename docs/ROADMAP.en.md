# Roadmap

## Completed

- Core reminder dashboard and authentication.
- One-time and recurring schedules with timezone handling.
- Telegram linking, wizard, commands, and private allowlist.
- Occurrence reliability, retry, repair, cleanup, and export/import.
- Light/dark theme and mobile layout pass.

## Planned

- Stronger database integration tests with two-user RLS fixtures.
- End-to-end tests for dashboard and Telegram workflows.
- A first-class restore/reopen flow for terminal reminders.
- More granular status filters and an occurrence timeline.

## Future ideas

- Email delivery through a verified provider.
- Official WhatsApp Business API integration with a provider account and consent model.
- Natural-language schedule parsing with explicit confirmation.
- Shared reminders and team roles.
- Usage dashboards and configurable notification policies.

## Non-goals

Unofficial WhatsApp Web automation, arbitrary public bot access, and storing provider secrets in frontend code are not roadmap items.
