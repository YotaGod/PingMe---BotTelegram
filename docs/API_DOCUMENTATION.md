# API Documentation

## Base URLs

Production function base URL:

```text
https://<project-ref>.supabase.co/functions/v1
```

The dashboard uses Supabase's project URL and public key. Replace placeholders with environment-specific values; never publish secret values in this document.

## Edge Functions

### `POST /telegram-webhook`

Receives Telegram updates. Configure Telegram's webhook `secret_token` to match `TELEGRAM_WEBHOOK_SECRET`. The function validates the request, allowlist, linked account, command, and callback ownership before changing data.

Supported commands include `/start`, `/help`, `/reminder`, `/edit`, `/list`, `/today`, `/upcoming`, `/delete`, and `/cancel`.

### `POST /telegram-link-token`

Creates or redeems the dashboard-to-Telegram linking flow. Tokens expire and only a hash is stored. Access is authenticated and ownership-checked.

### `POST /reminder-worker`

Internal scheduled delivery endpoint. It requires `x-worker-secret` matching `WORKER_SECRET` and must not be exposed as a public user API.

## Database RPCs

Important RPC contracts include:

- `claim_due_occurrences(integer)`: service-role worker claim.
- `apply_user_occurrence_action(uuid, text, integer)`: authenticated owner completion, snooze, or related action.
- `apply_telegram_occurrence_action(text, uuid, text, integer)`: service-role function with Telegram ownership resolution.
- `update_reminder_schedule(...)`: authenticated owner schedule replacement; cancels stale actionable occurrences and creates the latest valid one.
- `retry_failed_occurrence(uuid)`: authenticated owner retry for a failed occurrence.
- `get_reminder_health()`: authenticated user-scoped Reliability Center summary.
- `repair_stale_occurrences()`: authenticated repair operation scoped by the database rules.

## Error handling

Clients should display the returned error without exposing credentials or raw secret configuration. Common cases are an expired session, missing ownership, missing actionable occurrence, invalid schedule, missing Telegram link, and worker configuration failure.

## Compatibility rules

Use the migration-defined function signatures. Do not call occurrence tables directly from untrusted clients to mutate delivery state; use the RPC boundary.
