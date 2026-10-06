-- Keep dashboard actions consistent with Telegram while the worker is sending.
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

  select * into reminder_row
  from public.reminders
  where id = occurrence_row.reminder_id
  for update;
  if reminder_row.status not in ('active', 'paused') then
    raise exception 'Reminder is not actionable';
  end if;

  if p_action = 'complete' then
    if occurrence_row.status not in ('processing', 'sent', 'pending', 'snoozed', 'failed') then
      raise exception 'Occurrence is not actionable';
    end if;
    update public.reminder_occurrences
    set status = 'completed', completed_at = now(), snoozed_until = null, claimed_at = null
    where id = occurrence_row.id;
    if reminder_row.schedule_type = 'one_time' then
      update public.reminders set status = 'completed' where id = reminder_row.id;
    else
      next_at := public.next_occurrence_at(reminder_row.id, occurrence_row.scheduled_at);
      if next_at is not null then
        insert into public.reminder_occurrences(reminder_id, scheduled_at)
        values (reminder_row.id, next_at) on conflict do nothing;
      else
        update public.reminders set status = 'completed' where id = reminder_row.id;
      end if;
    end if;
  elsif p_action = 'skip' then
    if occurrence_row.status not in ('processing', 'sent', 'pending', 'snoozed', 'failed') then
      raise exception 'Occurrence is not actionable';
    end if;
    update public.reminder_occurrences
    set status = 'skipped', completed_at = now(), snoozed_until = null, claimed_at = null
    where id = occurrence_row.id;
    if reminder_row.schedule_type = 'one_time' then
      update public.reminders set status = 'completed' where id = reminder_row.id;
    else
      next_at := public.next_occurrence_at(reminder_row.id, occurrence_row.scheduled_at);
      if next_at is not null then
        insert into public.reminder_occurrences(reminder_id, scheduled_at)
        values (reminder_row.id, next_at) on conflict do nothing;
      else
        update public.reminders set status = 'completed' where id = reminder_row.id;
      end if;
    end if;
  elsif p_action = 'snooze' then
    if occurrence_row.status not in ('processing', 'sent', 'pending', 'snoozed') then
      raise exception 'Occurrence is not actionable';
    end if;
    if p_snooze_minutes not between 1 and 1440 then
      raise exception 'Snooze duration must be between 1 and 1440 minutes';
    end if;
    update public.reminder_occurrences
    set status = 'snoozed',
        snoozed_until = now() + make_interval(mins => p_snooze_minutes),
        claimed_at = null,
        last_error = null
    where id = occurrence_row.id;
  elsif p_action = 'disable' then
    update public.reminders set status = 'disabled' where id = reminder_row.id;
    update public.reminder_occurrences
    set status = 'cancelled', claimed_at = null, snoozed_until = null
    where reminder_id = reminder_row.id
      and status in ('pending', 'processing', 'snoozed', 'failed');
  else
    raise exception 'Invalid action';
  end if;
end;
$$;

revoke all on function public.apply_user_occurrence_action(uuid, text, integer) from public, anon;
grant execute on function public.apply_user_occurrence_action(uuid, text, integer) to authenticated;
