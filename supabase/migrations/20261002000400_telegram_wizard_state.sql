create table if not exists public.telegram_conversations (
  telegram_user_id text primary key check (telegram_user_id ~ '^[0-9]{1,20}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  chat_id bigint not null,
  step text not null check (step in ('title', 'message', 'schedule')),
  draft jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default now() + interval '30 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_conversations_expiry_idx
  on public.telegram_conversations(expires_at);

alter table public.telegram_conversations enable row level security;
revoke all on public.telegram_conversations from anon, authenticated;
grant all on public.telegram_conversations to service_role;