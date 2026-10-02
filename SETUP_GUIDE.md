# Panduan Setup PingMe

## Prasyarat

- Node.js 22+
- Akun Supabase
- Supabase CLI yang sudah login
- Bot Telegram dari BotFather
- Akun Vercel untuk frontend production

## Frontend lokal

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Isi `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

Publishable/anon key boleh digunakan browser. Jangan masukkan service-role key ke variabel `NEXT_PUBLIC_*`.

## Database Supabase

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Migrasi membuat schema, RLS, RPC ownership-checked, scheduler, wizard Telegram, cleanup, dan Reliability Center. Jangan menjalankan file SQL secara acak; gunakan `supabase db push` agar urutan migrasi terjaga.

## Function secrets

Set sebagai Supabase Function secrets, bukan di repository:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_ALLOWED_USER_IDS`
- `TELEGRAM_ALLOWLIST_REQUIRED=true`
- `WORKER_SECRET`

Supabase menyediakan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` untuk Edge Functions. Jangan menyalin nilai tersebut ke frontend.

## Deploy Edge Functions

```powershell
supabase functions deploy reminder-worker --no-verify-jwt
supabase functions deploy telegram-webhook --no-verify-jwt
supabase functions deploy telegram-link-token
```

Atur webhook Telegram ke:

```text
https://<project-ref>.supabase.co/functions/v1/telegram-webhook
```

Gunakan nilai `TELEGRAM_WEBHOOK_SECRET` sebagai `secret_token` webhook Telegram.

## Vercel

Hubungkan repository GitHub ke Vercel, lalu atur environment Production:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Setelah deploy, tambahkan URL production Vercel ke Supabase Auth redirect URLs. Backend secret Telegram tetap berada di Supabase, bukan Vercel frontend.

## Verifikasi

```powershell
npm run test:unit
npm run typecheck
npm run lint
npm run build
```

Periksa Supabase Cron, Edge Function logs, `notification_logs`, dan Reliability Center jika reminder tidak terkirim.
