# Release Guide

## Release flow

1. Create a focused branch from `main`.
2. Update code, migrations, tests, and documentation together.
3. Run unit tests, typecheck, lint, build, and database tests when available.
4. Apply migrations with `supabase db push` against the intended project.
5. Deploy changed Edge Functions.
6. Push to GitHub and let Vercel build the frontend.
7. Run the production smoke test and record the change in `CHANGELOG.md`.

## Deployment order

For schema-dependent changes:

1. Apply database migrations.
2. Deploy Edge Functions.
3. Deploy the frontend.
4. Verify Cron, Telegram webhook, and Reliability Center.

## Rollback

Frontend rollback should use the previous Vercel deployment. Function rollback should redeploy the last known-good source. Database migrations are additive where possible; do not run destructive rollback SQL without a verified backup and an explicit recovery plan.

## Release checklist

- [ ] No secret or private prompt file is tracked.
- [ ] Migration order is correct.
- [ ] Tests pass.
- [ ] Git working tree is clean.
- [ ] `main` is pushed.
- [ ] Vercel deployment is healthy.
- [ ] Edge Function logs are clean.
- [ ] Telegram command and notification smoke tests pass.
