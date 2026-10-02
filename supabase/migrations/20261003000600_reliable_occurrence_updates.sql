create or replace function public.update_reminder_schedule(
  p_reminder_id uuid,
  p_title text,
  p_message text,
  p_category text,
  p_priority text,
  p_schedule_type text,
  p_timezone text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_recurrence_rule jsonb
)
returns public.reminders
language plpgsql
security definer
set search_path = ''
as $$
declare
  reminder_row public.reminders%rowtype;
  next_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_title is null or char_length(trim(p_title)) not between 1 and 120 then
    raise exception 'Title must contain 1 to 120 characters';
  end if;
  if p_category is null or char_length(trim(p_category)) not between 1 and 40 then
    raise exception 'Category must contain 1 to 40 characters';
  end if;
  if p_priority not in ('low', 'medium', 'high') then
    raise exception 'Invalid priority';
  end if;
  if p_schedule_type not in ('one_time', 'daily', 'weekly', 'monthly') then
    raise exception 'Invalid schedule type';
  end if;
  if p_start_at is null or p_start_at <= now() then
    raise exception 'Reminder must be scheduled in the future';
  end if;
  if p_end_at is not null and p_end_at < p_start_at then
    raise exception 'End date must be after the start date';
  end if;
  if (p_schedule_type = 'one_time' and p_recurrence_rule is not null)
    or (p_schedule_type <> 'one_time' and (p_recurrence_rule is null or jsonb_typeof(p_recurrence_rule) <> 'object')) then
    raise exception 'Recurrence rule does not match schedule type';
  end if;

  select * into reminder_row
  from public.reminders
  where id = p_reminder_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'Reminder not found';
  end if;

  update public.reminder_occurrences
  set status = 'cancelled', claimed_at = null, snoozed_until = null
  where reminder_id = p_reminder_id
    and status in ('pending', 'processing', 'snoozed', 'failed');

  update public.reminders
  set title = trim(p_title),
      message = nullif(trim(coalesce(p_message, '')), ''),
      category = trim(p_category),
      priority = p_priority,
      schedule_type = p_schedule_type,
      timezone = p_timezone,
      start_at = p_start_at,
      end_at = p_end_at,
      recurrence_rule = p_recurrence_rule,
      status = 'active'
  where id = p_reminder_id;

  if p_schedule_type = 'one_time' then
    insert into public.reminder_occurrences(reminder_id, scheduled_at)
    values (p_reminder_id, p_start_at)
    on conflict (reminder_id, scheduled_at) do update
      set status = 'pending', claimed_at = null, snoozed_until = null,
          completed_at = null, sent_at = null, last_error = null;
  else
    next_at := public.next_occurrence_at(
      p_reminder_id,
      greatest(now(), p_start_at - interval '1 second')
    );
    if next_at is null then
      update public.reminders set status = 'completed' where id = p_reminder_id;
    else
      insert into public.reminder_occurrences(reminder_id, scheduled_at)
      values (p_reminder_id, next_at)
      on conflict (reminder_id, scheduled_at) do update
        set status = 'pending', claimed_at = null, snoozed_until = null,
            completed_at = null, sent_at = null, last_error = null;
    end if;
  end if;

  select * into reminder_row from public.reminders where id = p_reminder_id;
  return reminder_row;
end;
$$;

create or replace function public.retry_failed_occurrence(p_occurrence_id uuid)
returns public.reminder_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  occurrence_row public.reminder_occurrences%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.* into occurrence_row
  from public.reminder_occurrences o
  join public.reminders r on r.id = o.reminder_id
  where o.id = p_occurrence_id
    and r.user_id = auth.uid()
  for update of o;
  if not found then
    raise exception 'Occurrence not found';
  end if;
  if occurrence_row.status <> 'failed' then
    raise exception 'Only failed occurrences can be retried';
  end if;

  update public.reminder_occurrences
  set status = 'pending',
      attempt_count = 0,
      claimed_at = null,
      snoozed_until = null,
      last_error = null
  where id = p_occurrence_id
  returning * into occurrence_row;
  return occurrence_row;
end;
$$;

revoke all on function public.update_reminder_schedule(uuid, text, text, text, text, text, text, timestamptz, timestamptz, jsonb) from public, anon;
grant execute on function public.update_reminder_schedule(uuid, text, text, text, text, text, text, timestamptz, timestamptz, jsonb) to authenticated;
revoke all on function public.retry_failed_occurrence(uuid) from public, anon;
grant execute on function public.retry_failed_occurrence(uuid) to authenticated;
