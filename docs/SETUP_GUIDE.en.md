# PingMe Setup Guide

## Prerequisites

- Node.js 22+
- A Supabase project
- An authenticated Supabase CLI
- A Telegram bot created through BotFather
- A Vercel account for the production frontend

## Local frontend

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Set the public frontend values in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

The publishable/anon key is intended for browser use. Never put the service-role key in a `NEXT_PUBLIC_*` variable.

## Supabase database

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

The migrations create the schema, RLS, ownership-checked RPCs, scheduler, Telegram wizard, cleanup, and Reliability Center. Use `supabase db push` to preserve migration order.

## Function secrets

Set these as Supabase Function secrets, never in the repository:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_ALLOWED_USER_IDS`
- `TELEGRAM_ALLOWLIST_REQUIRED=true`
- `WORKER_SECRET`

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Do not copy those values into frontend code.

## Deploy Edge Functions

```powershell
supabase functions deploy reminder-worker --no-verify-jwt
supabase functions deploy telegram-webhook --no-verify-jwt
supabase functions deploy telegram-link-token
```

Set Telegram's webhook URL to `https://<project-ref>.supabase.co/functions/v1/telegram-webhook` and use `TELEGRAM_WEBHOOK_SECRET` as its `secret_token`.

## Vercel

Connect the GitHub repository to Vercel and set these Production variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Add the production Vercel URL to Supabase Auth redirect URLs. Keep Telegram backend secrets in Supabase, not in the Vercel frontend.
