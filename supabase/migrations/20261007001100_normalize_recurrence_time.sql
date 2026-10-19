-- Normalize recurrence times written with the Indonesian locale, such as 16.00.
update public.reminders
set recurrence_rule = jsonb_set(
  recurrence_rule,
  '{time}',
  to_jsonb(replace(recurrence_rule ->> 'time', '.', ':'))
)
where recurrence_rule ? 'time'
  and recurrence_rule ->> 'time' ~ '^\d{1,2}\.\d{2}$';

-- Keep recurrence calculation tolerant of legacy dotted times and correctly
-- match weekly day names stored in a JSONB array.
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
  weekday_name text;
begin
  select * into reminder_row from public.reminders where id = p_reminder_id;
  if not found or reminder_row.schedule_type = 'one_time' or reminder_row.status <> 'active' then
    return null;
  end if;

  frequency := reminder_row.recurrence_rule ->> 'frequency';
  candidate_time := replace(reminder_row.recurrence_rule ->> 'time', '.', ':')::time;
  repeat_days := coalesce(reminder_row.recurrence_rule -> 'days', '[]'::jsonb);
  month_day := nullif(reminder_row.recurrence_rule ->> 'day', '')::integer;
  local_date := (p_after at time zone reminder_row.timezone)::date;

  for offset_days in 0..370 loop
    candidate_date := local_date + offset_days;
    if frequency = 'daily' then
      null;
    elsif frequency = 'weekly' then
      weekday_name := case extract(isodow from candidate_date)::integer
        when 1 then 'monday'
        when 2 then 'tuesday'
        when 3 then 'wednesday'
        when 4 then 'thursday'
        when 5 then 'friday'
        when 6 then 'saturday'
        else 'sunday'
      end;
      if not (repeat_days @> jsonb_build_array(weekday_name)) then
        continue;
      end if;
    elsif frequency = 'monthly' then
      if month_day is null
        or month_day < 1
        or month_day > extract(day from (date_trunc('month', candidate_date) + interval '1 month - 1 day'))::integer
        or extract(day from candidate_date)::integer <> month_day then
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
