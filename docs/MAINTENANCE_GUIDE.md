# Maintenance Guide

## Daily checks

- Check Reliability Center for failed or stale occurrences.
- Review Supabase Cron run history and recent Edge Function logs.
- Confirm the Telegram webhook responds and the linked account remains correct.

## Database hygiene

Use the dashboard cleanup control with a deliberate retention period. Cleanup must never delete actionable future occurrences. Keep history only as long as it is useful for the owner and free-tier storage budget.

## Worker operations

The worker uses a shared secret, bounded claims, stale-claim recovery, and capped attempts. If delivery stops, verify `WORKER_SECRET`, Vault values, Cron, Telegram token validity, and `notification_logs` before changing application code.

## Backups and recovery

Enable Supabase backups appropriate to the project tier. Export reminders from the dashboard before risky migration work. Store exports securely because they contain personal reminder data.

## Dependency updates

Update Node, Next.js, Supabase libraries, and Edge Function imports deliberately. Run unit tests, typecheck, lint, build, and database contract tests after every dependency update.

## Incident response

1. Identify whether the failure is frontend, Auth, database, Cron, worker, Telegram, or configuration.
2. Preserve timestamps and occurrence IDs, never secrets.
3. Retry only failed occurrences after confirming the provider is healthy.
4. Repair stale occurrences only after confirming there is no active worker claim.
5. Record the cause and remediation in `CHANGELOG.md` or an incident note.
