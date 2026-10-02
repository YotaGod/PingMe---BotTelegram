# Reminder Reliability and Personal Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PingMe reliable for the owner's edited, recurring, and Telegram-delivered reminders while adding the highest-value personal workflow controls.

**Architecture:** Add additive Supabase migrations and RPCs so schedule replacement, retry, cleanup, and health reads are transactional and ownership-checked. Keep Telegram command formatting in the webhook function, shared schedule semantics in tested helpers, and dashboard controls in the existing client component until a focused split becomes necessary.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase PostgreSQL/RLS/Edge Functions, Deno, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-03-reminder-reliability-design.md`

## Global Constraints

- PostgreSQL remains the source of truth.
- Schedule edits and occurrence replacement happen in one security-definer RPC transaction.
- `/list` shows all reminders; `/today` shows all statuses for the owner's local date; `/upcoming` shows active reminders later today.
- Production Telegram access must fail closed when the allowlist is missing.
- Never expose service-role keys, bot tokens, webhook secrets, or worker secrets to browser code or logs.
- Every phase must pass unit tests, typecheck, lint, and build before its own commit and push.

## Review Focus

- Editing a recurring reminder after its old occurrence is pending must not deliver the old date; test in Task 1.
- A completed recurring reminder with a future occurrence must show the correct occurrence in list/date views; test in Task 2.
- A failed delivery retry must not create duplicate occurrences; test in Task 3.
- A missing Telegram allowlist must not permit arbitrary users in production mode; test in Task 4.
- Mobile dashboard controls must remain reachable and usable at narrow widths and in both themes; verify in Task 6.

### Task 1: Transactional schedule replacement

**Files:**
- Create: `supabase/migrations/20261003000600_reliable_occurrence_updates.sql`
- Modify: `supabase/tests/001_smart_reminder_schema.test.sql`
- Test: `tests/recurrence.test.ts` (add pure schedule cases where useful)

**Interfaces:**
- Produces `public.update_reminder_schedule(p_reminder_id uuid, p_title text, p_message text, p_category text, p_priority text, p_schedule_type text, p_timezone text, p_start_at timestamptz, p_end_at timestamptz, p_recurrence_rule jsonb)` returning `public.reminders`.
- Produces `public.retry_failed_occurrence(p_occurrence_id uuid)` for authenticated owners.

- [ ] Add failing pgTAP contract checks for both RPCs and ownership restrictions.
- [ ] Add the RPC to cancel pending/processing/snoozed occurrences, preserve historical rows, calculate the first valid occurrence after `now()` for recurring schedules, and insert at most one actionable occurrence.
- [ ] Ensure editing a completed/disabled reminder explicitly reactivates it only through the edit operation used by the UI, while preserving its existing status when no edit occurs.
- [ ] Add retry logic that resets only an owned failed occurrence, clears stale claim fields, and does not insert a duplicate occurrence.
- [ ] Add indexes or constraints only where the new queries need them.
- [ ] Run database tests if the linked Supabase test environment is available; otherwise run migration syntax/type checks and record the limitation.
- [ ] Commit and push: `fix: make reminder rescheduling transactional`.

### Task 2: Consistent Telegram and dashboard occurrence reads

**Files:**
- Modify: `supabase/functions/telegram-webhook/commands.ts`
- Modify: `src/components/reminder-dashboard.tsx`
- Modify: `src/lib/types.ts`
- Modify: `tests/recurrence.test.ts`

**Interfaces:**
- Consumes `update_reminder_schedule` from Task 1.
- Produces one shared selection rule: actionable occurrence is the nearest pending/processing/sent/snoozed/failed occurrence; date views filter before selecting.

- [ ] Add failing tests for `/list` including completed/cancelled/disabled reminders and for date filtering when an old occurrence precedes today's occurrence.
- [ ] Change Telegram `/list` to query all reminder statuses and keep `/upcoming` limited to active reminders later today.
- [ ] Select date-view occurrences after applying the local-date predicate, not before it, and use each reminder's own timezone for comparisons.
- [ ] Update dashboard fetch logic to distinguish `next_scheduled_at` from `last_scheduled_at`, preventing completed rows from falling back to a stale `start_at` when a history row exists.
- [ ] Route dashboard edits through `update_reminder_schedule` and refresh from the database after success.
- [ ] Run unit tests, typecheck, lint, and build.
- [ ] Commit and push: `fix: unify reminder occurrence views`.

### Task 3: Delivery retry and reliability data

**Files:**
- Create: `supabase/migrations/20261003000700_reliability_center.sql`
- Modify: `supabase/functions/reminder-worker/index.ts`
- Modify: `src/components/reminder-dashboard.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces `public.get_reminder_health()` returning user-scoped JSON with failed count, stale occurrence count, latest worker heartbeat, and recent delivery failures.
- Consumes `public.retry_failed_occurrence(uuid)` from Task 1.

- [ ] Add migration tables/RPCs for a non-secret worker heartbeat and user-scoped health summary.
- [ ] Make the worker write a heartbeat and preserve structured failure context without credentials.
- [ ] Add a Reliability Center panel with loading, empty, error, retry, and repair states.
- [ ] Add dashboard actions to retry a selected failed occurrence and refresh health after the action.
- [ ] Add tests for ownership and retry behavior.
- [ ] Run verification commands.
- [ ] Commit and push: `feat: add reminder reliability center`.

### Task 4: Private Telegram hardening and snooze choices

**Files:**
- Modify: `supabase/functions/telegram-webhook/index.ts`
- Modify: `supabase/functions/telegram-webhook/commands.ts`
- Modify: `supabase/functions/reminder-worker/index.ts`
- Modify: `README.md`

**Interfaces:**
- Produces a production-safe allowlist check and callback format `snooze|<occurrence-id>|<minutes>` with allowed durations 5, 10, 30, 60, and 1440.

- [ ] Add a fail-closed environment switch/check for production and document the exact required configuration.
- [ ] Add Telegram snooze choices while preserving ownership checks and validation bounds in the database RPC.
- [ ] Add dashboard snooze choices using the same supported durations.
- [ ] Add/update tests for invalid durations and private-user rejection.
- [ ] Deploy the changed `telegram-webhook` and `reminder-worker` functions after verification.
- [ ] Commit and push: `feat: harden private telegram delivery and snooze choices`.

### Task 5: Data hygiene, templates, bulk actions, and export/import

**Files:**
- Modify: `supabase/migrations/20261003000700_reliability_center.sql`
- Modify: `src/components/reminder-dashboard.tsx`
- Modify: `src/lib/types.ts`
- Modify: `src/app/globals.css`
- Modify: `README.md`

**Interfaces:**
- Produces user-facing retention controls, reminder templates, multi-select bulk actions, and JSON export/import with schema validation.

- [ ] Add configurable cleanup retention of 7, 30, 90, or 365 days while never deleting actionable occurrences.
- [ ] Add template creation for Personal, Work, Health, and Billing with editable fields, not fabricated data.
- [ ] Add bulk select/delete/pause/resume with confirmation and partial-error reporting.
- [ ] Add export/import JSON validation, duplicate-safe import behavior, and clear error messages.
- [ ] Add mobile layout and keyboard coverage for the new controls.
- [ ] Run verification commands.
- [ ] Commit and push: `feat: add reminder maintenance and workflow tools`.

### Task 6: Final audit and release verification

**Files:**
- Modify: `README.md`
- Modify: `anti-slop/audit-001-2026-10-03.md`

- [ ] Run unit tests, typecheck, lint, build, and database tests where available.
- [ ] Verify light/dark mode, keyboard focus, mobile overflow, empty/loading/error states, and all new buttons.
- [ ] Verify `git status` is clean and `main` matches `origin/main` after the final push.
- [ ] Record deployment commands and any Supabase/Vercel manual settings still required.
- [ ] Commit and push: `docs: record reliability release verification`.
