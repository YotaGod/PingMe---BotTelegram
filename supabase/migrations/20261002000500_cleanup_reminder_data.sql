create or replace function public.cleanup_user_reminder_data(p_keep_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cutoff_at timestamptz;
  deleted_logs integer := 0;
  deleted_occurrences integer := 0;
  deleted_channels integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_keep_days < 7 or p_keep_days > 3650 then
    raise exception 'Keep days must be between 7 and 3650';
  end if;

  cutoff_at := now() - make_interval(days => p_keep_days);

  delete from public.notification_logs l
  using public.reminder_occurrences o, public.reminders r
  where l.occurrence_id = o.id
    and o.reminder_id = r.id
    and r.user_id = auth.uid()
    and o.status in ('completed', 'skipped', 'cancelled', 'failed')
    and coalesce(l.sent_at, l.created_at) < cutoff_at;
  get diagnostics deleted_logs = row_count;

  delete from public.reminder_occurrences o
  using public.reminders r
  where o.reminder_id = r.id
    and r.user_id = auth.uid()
    and o.status in ('completed', 'skipped', 'cancelled', 'failed')
    and coalesce(o.completed_at, o.sent_at, o.updated_at, o.created_at) < cutoff_at;
  get diagnostics deleted_occurrences = row_count;

  delete from public.reminder_channels rc
  using public.reminders r
  where rc.reminder_id = r.id
    and r.user_id = auth.uid()
    and r.status in ('completed', 'cancelled', 'disabled');
  get diagnostics deleted_channels = row_count;

  return jsonb_build_object(
    'notification_logs', deleted_logs,
    'reminder_occurrences', deleted_occurrences,
    'reminder_channels', deleted_channels,
    'keep_days', p_keep_days
  );
end;
$$;

revoke all on function public.cleanup_user_reminder_data(integer) from public, anon;
grant execute on function public.cleanup_user_reminder_data(integer) to authenticated;
