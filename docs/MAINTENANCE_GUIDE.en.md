# Maintenance Guide

## Daily checks

- Check the Reliability Center for failed or stale occurrences.
- Review Supabase Cron history and recent Edge Function logs.
- Confirm that the Telegram webhook responds and the linked account is correct.

## Database hygiene

Use the dashboard cleanup control with a deliberate retention period. Cleanup must never remove actionable future occurrences. Keep history only as long as it is useful and compatible with the free-tier storage budget.

## Worker operations

The worker uses a shared secret, bounded claims, stale-claim recovery, and capped attempts. If delivery stops, verify `WORKER_SECRET`, Vault values, Cron, Telegram token validity, and `notification_logs` before changing application code.

## Backups and recovery

Enable Supabase backups appropriate to the project tier. Export reminders before risky migration work and store exports securely because they contain personal data.

## Dependency updates

Update Node, Next.js, Supabase libraries, and Edge Function imports deliberately. Run unit tests, typecheck, lint, build, and database contract tests after every dependency update.

## Incident response

Identify the failing layer, preserve timestamps and occurrence IDs without secrets, retry only failed occurrences, repair stale claims only after checking the worker, and record the cause and remediation.
