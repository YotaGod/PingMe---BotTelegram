# Testing Guide

## Test layers

- Unit tests cover recurrence, timezone behavior, occurrence selection, Telegram policy, schedule parsing, health summaries, and reminder status transitions.
- Typecheck catches contract drift in TypeScript.
- ESLint checks source quality.
- Next build validates the production bundle.
- pgTAP/database tests cover schema, RLS, and RPC contracts when a test database is available.

## Commands

```powershell
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm run test:db
```

## Required regression cases

- A completed reminder cannot be completed or snoozed again.
- Editing a completed reminder replaces stale actionable occurrences.
- A daily/weekly/monthly reminder retains its local time and timezone.
- `/today` filters by the reminder's local date before selecting an occurrence.
- `/upcoming` excludes past and inactive reminders.
- A missing Telegram allowlist fails closed.
- Two users cannot access one another's reminders through direct reads or RPCs.
- A failed delivery retry does not create a duplicate actionable occurrence.

## Database test limitation

`npm run test:db` requires a running local Supabase/PostgreSQL test environment. If unavailable, run all frontend/unit checks and record the limitation; do not claim database verification passed.

## Manual smoke test

Create a one-time reminder, verify it in the dashboard, link Telegram, trigger `/list`, complete it, reload, edit it to a future time, and confirm that the new schedule is used. Check both light/dark themes and a narrow mobile viewport.
