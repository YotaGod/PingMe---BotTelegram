# PingMe — Smart Reminder

[🇮🇩 Bahasa Indonesia](./README.md) | 🇺🇸 English

PingMe is a personal reminder application built with Next.js, Supabase, and Telegram. It supports one-time and recurring reminders, history, snoozing, and Telegram notifications.

## Core features

- Email/password authentication through Supabase Auth.
- One-time, daily, weekly, and monthly schedules.
- IANA time zones, priorities, categories, messages, end dates, and weekday presets.
- Dashboard, calendar, occurrence history, search, filters, light/dark theme, and PWA support.
- Telegram `/start`, `/help`, `/reminder`, `/edit`, `/list`, `/today`, `/upcoming`, `/delete`, and `/cancel`.
- Telegram inline buttons for category, priority, recurrence, snoozing, deletion, and flow recovery.
- Reliability Center for failed deliveries, stale occurrences, retry, repair, and cleanup.
- JSON export/import, quick templates, bulk actions, and retention cleanup.
- Private-by-default Telegram access through an allowed-user list.

## Quick start

1. Use Node.js 22 or later.
2. Copy `.env.example` to `.env.local`.
3. Set only the Supabase URL and public publishable/anon key for the frontend.
4. Run:

   ```powershell
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000`.

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for the complete setup.

## Architecture at a glance

The browser uses Supabase Auth and Postgres through RLS. Supabase Cron invokes `reminder-worker` every minute. The worker atomically claims due occurrences and sends Telegram notifications. `telegram-webhook` handles commands and callbacks with ownership checks.

Full documentation:

- [Documentation Analysis](./docs/DOCUMENTATION_ANALYSIS.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/API_DOCUMENTATION.md)
- [Security](./docs/SECURITY.md)
- [Testing Guide](./docs/TESTING_GUIDE.md)
- [Maintenance Guide](./docs/MAINTENANCE_GUIDE.md)
- [Release Guide](./docs/RELEASE_GUIDE.md)
- [Migration History](./docs/MIGRATION_HISTORY.md)
- [Changelog](./docs/CHANGELOG.md)
- [Roadmap](./docs/ROADMAP.md)
- [Contributing](./docs/CONTRIBUTING.md)

## Development commands

```powershell
npm run dev
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm run test:db
```

`test:db` requires an available PostgreSQL/Supabase test environment. See [TESTING_GUIDE.md](./docs/TESTING_GUIDE.md).

## Security

Never commit `.env`, service-role keys, Telegram bot tokens, webhook secrets, worker secrets, JWT signing secrets, or database passwords. The browser should receive only `NEXT_PUBLIC_SUPABASE_URL` and the public publishable/anon key. Store backend secrets in Supabase Function secrets/Vault.

See [SECURITY.md](./docs/SECURITY.md) before deployment.

## License

This project is licensed under the [MIT License](./LICENSE).
