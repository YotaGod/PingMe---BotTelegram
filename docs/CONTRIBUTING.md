# Contributing

## Before opening a change

Read the README, architecture, security, and testing guides. Keep user data ownership and timezone behavior explicit.

## Git workflow

- Start from an up-to-date `main`.
- Use a focused branch such as `codex/fix-occurrence-state`.
- Keep commits small and describe the user-visible behavior.
- Never commit `.env`, private prompts, generated build output, or provider credentials.

## Code standards

- Preserve TypeScript strictness and existing formatting.
- Put delivery state changes behind ownership-checked RPCs.
- Add a regression test for every bug fix.
- Keep UI controls keyboard-accessible and usable on mobile.
- Use Indonesian for user-facing dashboard/Telegram copy when the existing flow is Indonesian; use English for developer documentation unless the document is explicitly Indonesian.

## Pull request checklist

- [ ] Scope and risk are explained.
- [ ] Tests, typecheck, lint, and build pass.
- [ ] Database migrations are included when schema changes.
- [ ] Security impact is documented.
- [ ] No secrets or private prompt documents are included.
