create table if not exists public.worker_health (
  id boolean primary key default true check (id),
  started_at timestamptz,
  finished_at timestamptz,
  claimed_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.worker_health enable row level security;
revoke all on public.worker_health from anon, authenticated;
grant all on public.worker_health to service_role;

create or replace function public.get_reminder_health()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  failed_count integer;
  stale_count integer;
  worker_row public.worker_health%rowtype;
  recent_failures jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select count(*) into failed_count
  from public.reminder_occurrences o
  join public.reminders r on r.id = o.reminder_id
  where r.user_id = auth.uid() and o.status = 'failed';

  select count(*) into stale_count
  from public.reminder_occurrences o
  join public.reminders r on r.id = o.reminder_id
  where r.user_id = auth.uid()
    and o.status = 'processing'
    and o.claimed_at < now() - interval '5 minutes';

  select coalesce(jsonb_agg(row_to_json(failure) order by failure.created_at desc), '[]'::jsonb)
  into recent_failures
  from (
    select l.occurrence_id, l.created_at, r.title, l.error_message, l.attempt_number
    from public.notification_logs l
    join public.reminder_occurrences o on o.id = l.occurrence_id
    join public.reminders r on r.id = o.reminder_id
    where r.user_id = auth.uid() and l.status = 'failed'
    order by l.created_at desc
    limit 10
  ) failure;

  select * into worker_row from public.worker_health where id = true;

  return jsonb_build_object(
    'failed_occurrences', failed_count,
    'stale_occurrences', stale_count,
    'recent_failures', recent_failures,
    'worker', jsonb_build_object(
      'started_at', worker_row.started_at,
      'finished_at', worker_row.finished_at,
      'claimed_count', worker_row.claimed_count,
      'sent_count', worker_row.sent_count,
      'failed_count', worker_row.failed_count,
      'last_error', worker_row.last_error,
      'updated_at', worker_row.updated_at
    )
  );
end;
$$;

revoke all on function public.get_reminder_health() from public, anon;
grant execute on function public.get_reminder_health() to authenticated;

create or replace function public.repair_stale_occurrences()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  repaired integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.reminder_occurrences o
  set status = 'pending',
      claimed_at = null,
      last_error = 'Requeued by owner after stale worker claim'
  from public.reminders r
  where o.reminder_id = r.id
    and r.user_id = auth.uid()
    and o.status = 'processing'
    and o.claimed_at < now() - interval '5 minutes';
  get diagnostics repaired = row_count;
  return repaired;
end;
$$;

revoke all on function public.repair_stale_occurrences() from public, anon;
grant execute on function public.repair_stale_occurrences() to authenticated;
