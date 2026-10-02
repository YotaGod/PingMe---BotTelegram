# Security Policy

## Security boundary

PingMe is designed for a private owner account. Supabase RLS is the primary data boundary. Telegram users must be linked and, in production, must pass `TELEGRAM_ALLOWED_USER_IDS` when the allowlist requirement is enabled.

## Secrets

Never commit or paste the following into source control, browser variables, screenshots, or issue reports:

- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `WORKER_SECRET`
- JWT signing secrets
- Database URLs containing passwords

Only the Supabase URL and public publishable/anon key belong in `NEXT_PUBLIC_*` variables.

## Authentication and authorization

Dashboard access uses Supabase Auth. Database policies scope records to the authenticated user. Security-definer functions validate ownership explicitly. Telegram callbacks resolve the linked owner before applying an action.

## Deployment security

- Store function secrets in Supabase secrets/Vault.
- Keep Vercel environment variables limited to public frontend configuration.
- Use the exact Telegram webhook secret token.
- Keep `TELEGRAM_ALLOWLIST_REQUIRED=true` in production.
- Review Supabase Cron and Edge Function logs for unexpected failures.
- Do not log token values or full authorization headers.

## Reporting a vulnerability

Do not open a public issue containing a secret or exploit details. Contact the repository owner privately, include the affected component, reproduction steps, impact, and whether a credential was exposed. Rotate the credential first if it may still be valid.

## If a secret is exposed

1. Revoke or rotate it immediately at the provider.
2. Remove it from local files and shell history.
3. Inspect Git history and GitHub secret-scanning alerts.
4. Rewrite history only after coordinating with all repository users.
5. Redeploy affected Functions and verify the webhook/worker health.
