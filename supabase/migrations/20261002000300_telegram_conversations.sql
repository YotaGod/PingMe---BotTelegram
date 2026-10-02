create table if not exists public.telegram_conversations (
  telegram_user_id text primary key check (telegram_user_id ~ '^[0-9]{1,20}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  chat_id bigint not null,
  step text not null check (step in ('title', 'message', 'schedule')),
  draft jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_conversations
  add column if not exists expires_at timestamptz not null default now() + interval '30 minutes';

create index if not exists telegram_conversations_user_idx
  on public.telegram_conversations(user_id, updated_at desc);

alter table public.telegram_conversations enable row level security;
revoke all on public.telegram_conversations from anon, authenticated;
grant all on public.telegram_conversations to service_role;
