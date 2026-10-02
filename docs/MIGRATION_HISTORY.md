# Migration History

| Migration | Purpose |
|---|---|
| `20261002000100_smart_reminder.sql` | Core tables, indexes, RLS, recurrence, ownership-checked RPCs, channels, and notification logging. |
| `20261002000200_scheduler.sql` | Supabase Vault-backed worker scheduling and one-minute Cron invocation. |
| `20261002000300_telegram_conversations.sql` | Short-lived Telegram conversation state. |
| `20261002000400_telegram_wizard_state.sql` | Interactive reminder wizard state and expiry support. |
| `20261002000500_cleanup_reminder_data.sql` | Retention cleanup for historical occurrences and inactive reminder data. |
| `20261003000600_reliable_occurrence_updates.sql` | Transactional schedule replacement, stale occurrence cancellation, and failed-occurrence retry. |
| `20261003000700_reliability_center.sql` | Worker health, user-scoped diagnostics, stale repair, and operational summaries. |

## Rules for future migrations

- Use a new timestamped filename; never edit an applied migration in place.
- Prefer additive, ownership-aware, reversible changes.
- Add pgTAP contract checks for new tables, functions, and security boundaries.
- Apply with `supabase db push` and record the result.
- Document data backfill, retention impact, and rollback considerations.
