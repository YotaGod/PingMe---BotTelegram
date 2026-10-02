create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text not null default 'Asia/Jakarta',
  locale text not null default 'id-ID',
  telegram_notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_timezone_idx on public.profiles(timezone);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  message text check (message is null or char_length(message) <= 1000),
  category text not null default 'Personal' check (char_length(trim(category)) between 1 and 40),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  schedule_type text not null check (schedule_type in ('one_time', 'daily', 'weekly', 'monthly')),
  timezone text not null default 'Asia/Jakarta',
  start_at timestamptz not null,
  end_at timestamptz,
  recurrence_rule jsonb,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at is null or end_at >= start_at),
  check ((schedule_type = 'one_time' and recurrence_rule is null) or (schedule_type <> 'one_time' and jsonb_typeof(recurrence_rule) = 'object'))
);

create index reminders_user_status_start_idx on public.reminders(user_id, status, start_at);
create index reminders_active_start_idx on public.reminders(status, start_at) where status = 'active';

create table public.reminder_occurrences (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'completed', 'snoozed', 'skipped', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  claimed_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  snoozed_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reminder_id, scheduled_at)
);

create index occurrences_reminder_idx on public.reminder_occurrences(reminder_id);
create index occurrences_status_schedule_idx on public.reminder_occurrences(status, scheduled_at);
create index occurrences_schedule_idx on public.reminder_occurrences(scheduled_at);
create index occurrences_claimed_idx on public.reminder_occurrences(claimed_at);

create table public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('telegram', 'whatsapp', 'email')),
  type text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.notification_channels(name, type)
values ('telegram', 'messaging')
on conflict (name) do nothing;

create table public.reminder_channels (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  channel_id uuid not null references public.notification_channels(id) on delete restrict,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (reminder_id, channel_id)
);

create index reminder_channels_reminder_idx on public.reminder_channels(reminder_id);

insert into public.reminder_channels(reminder_id, channel_id)
select r.id, c.id
from public.reminders r
cross join public.notification_channels c
where c.name = 'telegram'
on conflict (reminder_id, channel_id) do nothing;

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.reminder_occurrences(id) on delete cascade,
  channel_id uuid not null references public.notification_channels(id) on delete restrict,
  status text not null check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt_number integer not null check (attempt_number > 0),
  provider_message_id text,
  sent_at timestamptz,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (occurrence_id, channel_id, attempt_number)
);

create index notification_logs_occurrence_idx on public.notification_logs(occurrence_id, created_at desc);

create table public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('telegram')),
  provider_user_id text not null,
  username text,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, provider_user_id),
  unique (user_id, provider)
);

create index user_integrations_user_idx on public.user_integrations(user_id);

create table public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index telegram_link_tokens_expiry_idx on public.telegram_link_tokens(expires_at) where consumed_at is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger reminders_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();
create trigger occurrences_updated_at before update on public.reminder_occurrences
  for each row execute function public.set_updated_at();

create or replace function public.next_occurrence_at(p_reminder_id uuid, p_after timestamptz)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  reminder_row public.reminders%rowtype;
  local_date date;
  candidate_date date;
  candidate_at timestamptz;
  candidate_time time;
  frequency text;
  repeat_days jsonb;
  month_day integer;
  offset_days integer;
begin
  select * into reminder_row from public.reminders where id = p_reminder_id;
  if not found or reminder_row.schedule_type = 'one_time' or reminder_row.status <> 'active' then
    return null;
  end if;

  frequency := reminder_row.recurrence_rule ->> 'frequency';
  candidate_time := (reminder_row.recurrence_rule ->> 'time')::time;
  repeat_days := coalesce(reminder_row.recurrence_rule -> 'days', '[]'::jsonb);
  month_day := nullif(reminder_row.recurrence_rule ->> 'day', '')::integer;
  local_date := (p_after at time zone reminder_row.timezone)::date;

  for offset_days in 0..370 loop
    candidate_date := local_date + offset_days;
    if frequency = 'daily' then
      null;
    elsif frequency = 'weekly' then
      if not (repeat_days @> to_jsonb(case extract(isodow from candidate_date)::integer
        when 1 then 'monday'
        when 2 then 'tuesday'
        when 3 then 'wednesday'
        when 4 then 'thursday'
        when 5 then 'friday'
        when 6 then 'saturday'
        else 'sunday'
      end)) then
        continue;
      end if;
    elsif frequency = 'monthly' then
      if month_day is null or month_day < 1 or month_day > extract(day from (date_trunc('month', candidate_date) + interval '1 month - 1 day'))::integer or extract(day from candidate_date)::integer <> month_day then
        continue;
      end if;
    else
      return null;
    end if;

    candidate_at := (candidate_date + candidate_time) at time zone reminder_row.timezone;
    if candidate_at > p_after and (reminder_row.end_at is null or candidate_at <= reminder_row.end_at) then
      return candidate_at;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.seed_first_occurrence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reminder_occurrences(reminder_id, scheduled_at)
  values (new.id, new.start_at)
  on conflict (reminder_id, scheduled_at) do nothing;
  insert into public.reminder_channels(reminder_id, channel_id, enabled)
  select new.id, c.id, p.telegram_notifications_enabled
  from public.notification_channels c
  join public.profiles p on p.id = new.user_id
  where c.name = 'telegram'
  on conflict (reminder_id, channel_id) do nothing;
  return new;
end;
$$;

create trigger reminders_seed_occurrence after insert on public.reminders
  for each row execute function public.seed_first_occurrence();

create or replace function public.sync_schedule_occurrence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.start_at, new.timezone, new.schedule_type, new.recurrence_rule, new.end_at)
     is distinct from
     (old.start_at, old.timezone, old.schedule_type, old.recurrence_rule, old.end_at) then
    update public.reminder_occurrences
    set status = 'cancelled'
    where reminder_id = new.id and status in ('pending', 'snoozed');

    if new.status in ('active', 'paused') then
      insert into public.reminder_occurrences(reminder_id, scheduled_at)
      values (new.id, new.start_at)
      on conflict (reminder_id, scheduled_at) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger reminders_sync_schedule after update of start_at, timezone, schedule_type, recurrence_rule, end_at on public.reminders
  for each row execute function public.sync_schedule_occurrence();

create or replace function public.apply_user_occurrence_action(
  p_occurrence_id uuid,
  p_action text,
  p_snooze_minutes integer default 10
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  occurrence_row public.reminder_occurrences%rowtype;
  reminder_row public.reminders%rowtype;
  next_at timestamptz;
begin
  select o.* into occurrence_row
  from public.reminder_occurrences o
  join public.reminders r on r.id = o.reminder_id
  where o.id = p_occurrence_id and r.user_id = auth.uid()
  for update of o;
  if not found then raise exception 'Occurrence not found'; end if;

  select * into reminder_row from public.reminders where id = occurrence_row.reminder_id for update;
  if reminder_row.status not in ('active', 'paused') then raise exception 'Reminder is not actionable'; end if;

  if p_action = 'complete' then
    if occurrence_row.status not in ('sent', 'pending', 'snoozed', 'failed') then raise exception 'Occurrence is not actionable'; end if;
    update public.reminder_occurrences set status = 'completed', completed_at = now(), snoozed_until = null where id = occurrence_row.id;
    if reminder_row.schedule_type = 'one_time' then
      update public.reminders set status = 'completed' where id = reminder_row.id;
    else
      next_at := public.next_occurrence_at(reminder_row.id, occurrence_row.scheduled_at);
      if next_at is not null then
        insert into public.reminder_occurrences(reminder_id, scheduled_at) values (reminder_row.id, next_at) on conflict do nothing;
      else
        update public.reminders set status = 'completed' where id = reminder_row.id;
      end if;
    end if;
  elsif p_action = 'skip' then
    update public.reminder_occurrences set status = 'skipped', completed_at = now(), snoozed_until = null where id = occurrence_row.id;
    if reminder_row.schedule_type = 'one_time' then
      update public.reminders set status = 'completed' where id = reminder_row.id;
    else
      next_at := public.next_occurrence_at(reminder_row.id, occurrence_row.scheduled_at);
      if next_at is not null then
        insert into public.reminder_occurrences(reminder_id, scheduled_at) values (reminder_row.id, next_at) on conflict do nothing;
      else
        update public.reminders set status = 'completed' where id = reminder_row.id;
      end if;
    end if;
  elsif p_action = 'snooze' then
    if p_snooze_minutes not between 1 and 1440 then raise exception 'Snooze duration must be between 1 and 1440 minutes'; end if;
    update public.reminder_occurrences set status = 'snoozed', snoozed_until = now() + make_interval(mins => p_snooze_minutes) where id = occurrence_row.id;
  elsif p_action = 'disable' then
    update public.reminders set status = 'disabled' where id = reminder_row.id;
    update public.reminder_occurrences set status = 'cancelled' where reminder_id = reminder_row.id and status in ('pending', 'snoozed');
  else
    raise exception 'Invalid action';
  end if;
end;
$$;

create or replace function public.claim_due_occurrences(p_batch_size integer default 40)
returns setof public.reminder_occurrences
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reminder_occurrences
  set status = case when attempt_count >= 5 then 'failed' else 'pending' end,
      claimed_at = null,
      last_error = coalesce(last_error, 'Recovered stale worker claim')
  where status = 'processing' and claimed_at < now() - interval '5 minutes';

  update public.reminder_occurrences o
  set status = 'cancelled'
  from public.reminders r
  where o.reminder_id = r.id and r.status in ('cancelled', 'disabled', 'completed') and o.status in ('pending', 'snoozed');

  return query
  with due as (
    select o.id
    from public.reminder_occurrences o
    join public.reminders r on r.id = o.reminder_id
    where r.status = 'active'
      and r.start_at <= now()
      and (r.end_at is null or r.end_at >= o.scheduled_at)
      and exists (select 1 from public.user_integrations ui where ui.user_id = r.user_id and ui.provider = 'telegram')
      and exists (
        select 1 from public.reminder_channels rc
        join public.notification_channels nc on nc.id = rc.channel_id
        where rc.reminder_id = r.id and rc.enabled and nc.name = 'telegram' and nc.enabled
      )
      and o.attempt_count < 5
      and ((o.status = 'pending' and o.scheduled_at <= now()) or (o.status = 'snoozed' and o.snoozed_until <= now()))
    order by coalesce(o.snoozed_until, o.scheduled_at), o.created_at
    for update of o skip locked
    limit greatest(1, least(p_batch_size, 100))
  )
  update public.reminder_occurrences o
  set status = 'processing', claimed_at = now(), attempt_count = o.attempt_count + 1
  from due
  where o.id = due.id
  returning o.*;
end;
$$;

create or replace function public.apply_telegram_occurrence_action(
  p_telegram_user_id text,
  p_occurrence_id uuid,
  p_action text,
  p_snooze_minutes integer default 10
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  occurrence_row public.reminder_occurrences%rowtype;
  reminder_row public.reminders%rowtype;
  next_at timestamptz;
begin
  select ui.user_id into owner_id
  from public.user_integrations ui
  where ui.provider = 'telegram' and ui.provider_user_id = p_telegram_user_id;
  if owner_id is null then raise exception 'Telegram account is not linked'; end if;

  select o.* into occurrence_row
  from public.reminder_occurrences o
  join public.reminders r on r.id = o.reminder_id
  where o.id = p_occurrence_id and r.user_id = owner_id
  for update of o;
  if not found then raise exception 'Occurrence not found'; end if;

  select * into reminder_row from public.reminders where id = occurrence_row.reminder_id for update;
  if reminder_row.status <> 'active' then raise exception 'Reminder is not active'; end if;

  if p_action = 'complete' then
    if occurrence_row.status not in ('sent', 'pending', 'snoozed', 'failed') then raise exception 'Occurrence is not actionable'; end if;
    update public.reminder_occurrences set status = 'completed', completed_at = now(), snoozed_until = null where id = occurrence_row.id;
    if reminder_row.schedule_type = 'one_time' then
      update public.reminders set status = 'completed' where id = reminder_row.id;
    else
      next_at := public.next_occurrence_at(reminder_row.id, occurrence_row.scheduled_at);
      if next_at is null then
        update public.reminders set status = 'completed' where id = reminder_row.id;
      else
        insert into public.reminder_occurrences(reminder_id, scheduled_at) values (reminder_row.id, next_at) on conflict do nothing;
      end if;
    end if;
  elsif p_action = 'skip' then
    if occurrence_row.status not in ('sent', 'pending', 'snoozed', 'failed') then raise exception 'Occurrence is not actionable'; end if;
    update public.reminder_occurrences set status = 'skipped', completed_at = now(), snoozed_until = null where id = occurrence_row.id;
    if reminder_row.schedule_type = 'one_time' then
      update public.reminders set status = 'completed' where id = reminder_row.id;
    else
      next_at := public.next_occurrence_at(reminder_row.id, occurrence_row.scheduled_at);
      if next_at is null then
        update public.reminders set status = 'completed' where id = reminder_row.id;
      else
        insert into public.reminder_occurrences(reminder_id, scheduled_at) values (reminder_row.id, next_at) on conflict do nothing;
      end if;
    end if;
  elsif p_action = 'snooze' then
    if occurrence_row.status not in ('sent', 'pending', 'snoozed') then raise exception 'Occurrence is not actionable'; end if;
    if p_snooze_minutes not between 1 and 1440 then raise exception 'Snooze duration must be between 1 and 1440 minutes'; end if;
    update public.reminder_occurrences set status = 'snoozed', snoozed_until = now() + make_interval(mins => p_snooze_minutes) where id = occurrence_row.id;
  elsif p_action = 'disable' then
    update public.reminders set status = 'disabled' where id = reminder_row.id;
    update public.reminder_occurrences set status = 'cancelled' where reminder_id = reminder_row.id and status in ('pending', 'snoozed');
  else
    raise exception 'Invalid action';
  end if;
end;
$$;

create or replace function public.link_telegram_account(
  p_token_hash text,
  p_telegram_user_id text,
  p_username text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.telegram_link_tokens%rowtype;
  integration_id uuid;
begin
  if p_telegram_user_id !~ '^[0-9]{1,20}$' then return false; end if;

  select * into link_row
  from public.telegram_link_tokens
  where token_hash = p_token_hash and consumed_at is null and expires_at > now()
  for update;
  if not found then return false; end if;

  select id into integration_id
  from public.user_integrations
  where user_id = link_row.user_id and provider = 'telegram';
  if integration_id is null then
    insert into public.user_integrations(user_id, provider, provider_user_id, username, linked_at)
    values (link_row.user_id, 'telegram', p_telegram_user_id, p_username, now());
  else
    update public.user_integrations
    set provider_user_id = p_telegram_user_id, username = p_username, linked_at = now()
    where id = integration_id;
  end if;

  update public.telegram_link_tokens set consumed_at = now() where id = link_row.id;
  return true;
exception when unique_violation then
  return false;
end;
$$;

create or replace function public.set_telegram_notifications(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.profiles
  set telegram_notifications_enabled = p_enabled
  where id = auth.uid();
  insert into public.reminder_channels(reminder_id, channel_id, enabled)
  select r.id, c.id, p_enabled
  from public.reminders r
  cross join public.notification_channels c
  where r.user_id = auth.uid() and c.name = 'telegram'
  on conflict (reminder_id, channel_id) do update set enabled = excluded.enabled;
end;
$$;

alter table public.profiles enable row level security;
alter table public.reminders enable row level security;
alter table public.reminder_occurrences enable row level security;
alter table public.notification_channels enable row level security;
alter table public.reminder_channels enable row level security;
alter table public.notification_logs enable row level security;
alter table public.user_integrations enable row level security;
alter table public.telegram_link_tokens enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles_delete_own" on public.profiles for delete to authenticated using (id = (select auth.uid()));

create policy "reminders_select_own" on public.reminders for select to authenticated using (user_id = (select auth.uid()));
create policy "reminders_insert_own" on public.reminders for insert to authenticated with check (user_id = (select auth.uid()));
create policy "reminders_update_own" on public.reminders for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reminders_delete_own" on public.reminders for delete to authenticated using (user_id = (select auth.uid()));

create policy "occurrences_select_own" on public.reminder_occurrences for select to authenticated
  using (exists (select 1 from public.reminders r where r.id = reminder_id and r.user_id = (select auth.uid())));
create policy "occurrences_insert_denied" on public.reminder_occurrences for insert to authenticated with check (false);
create policy "occurrences_update_denied" on public.reminder_occurrences for update to authenticated using (false) with check (false);
create policy "occurrences_delete_denied" on public.reminder_occurrences for delete to authenticated using (false);

create policy "channels_select_enabled" on public.notification_channels for select to authenticated using (enabled);

create policy "reminder_channels_select_own" on public.reminder_channels for select to authenticated
  using (exists (select 1 from public.reminders r where r.id = reminder_id and r.user_id = (select auth.uid())));
create policy "reminder_channels_insert_own" on public.reminder_channels for insert to authenticated
  with check (exists (select 1 from public.reminders r where r.id = reminder_id and r.user_id = (select auth.uid())));
create policy "reminder_channels_update_own" on public.reminder_channels for update to authenticated
  using (exists (select 1 from public.reminders r where r.id = reminder_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.reminders r where r.id = reminder_id and r.user_id = (select auth.uid())));
create policy "reminder_channels_delete_own" on public.reminder_channels for delete to authenticated
  using (exists (select 1 from public.reminders r where r.id = reminder_id and r.user_id = (select auth.uid())));

create policy "notification_logs_select_own" on public.notification_logs for select to authenticated
  using (exists (select 1 from public.reminder_occurrences o join public.reminders r on r.id = o.reminder_id where o.id = occurrence_id and r.user_id = (select auth.uid())));
create policy "notification_logs_insert_denied" on public.notification_logs for insert to authenticated with check (false);
create policy "notification_logs_update_denied" on public.notification_logs for update to authenticated using (false) with check (false);
create policy "notification_logs_delete_denied" on public.notification_logs for delete to authenticated using (false);

create policy "integrations_select_own" on public.user_integrations for select to authenticated using (user_id = (select auth.uid()));
create policy "integrations_insert_denied" on public.user_integrations for insert to authenticated with check (false);
create policy "integrations_update_denied" on public.user_integrations for update to authenticated using (false) with check (false);
create policy "integrations_delete_own" on public.user_integrations for delete to authenticated using (user_id = (select auth.uid()));

revoke all on function public.next_occurrence_at(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.seed_first_occurrence() from public, anon, authenticated;
revoke all on function public.claim_due_occurrences(integer) from public, anon, authenticated;
grant execute on function public.claim_due_occurrences(integer) to service_role;
grant execute on function public.next_occurrence_at(uuid, timestamptz) to service_role;
revoke all on function public.apply_user_occurrence_action(uuid, text, integer) from public, anon;
grant execute on function public.apply_user_occurrence_action(uuid, text, integer) to authenticated;
revoke all on function public.apply_telegram_occurrence_action(text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.apply_telegram_occurrence_action(text, uuid, text, integer) to service_role;
revoke all on function public.link_telegram_account(text, text, text) from public, anon, authenticated;
grant execute on function public.link_telegram_account(text, text, text) to service_role;
revoke all on function public.set_telegram_notifications(boolean) from public, anon;
grant execute on function public.set_telegram_notifications(boolean) to authenticated;

grant select, insert, update, delete on public.profiles, public.reminders, public.reminder_occurrences,
  public.notification_channels, public.reminder_channels, public.notification_logs,
  public.user_integrations to authenticated;
grant all on public.profiles, public.reminders, public.reminder_occurrences,
  public.notification_channels, public.reminder_channels, public.notification_logs,
  public.user_integrations, public.telegram_link_tokens to service_role;
