begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(20);

select extensions.has_table('public', 'profiles', 'profiles table exists');
select extensions.has_table('public', 'reminders', 'reminders table exists');
select extensions.has_table('public', 'reminder_occurrences', 'occurrences table exists');
select extensions.has_table('public', 'notification_channels', 'notification channels table exists');
select extensions.has_table('public', 'reminder_channels', 'reminder channels table exists');
select extensions.has_table('public', 'notification_logs', 'notification logs table exists');
select extensions.has_table('public', 'user_integrations', 'user integrations table exists');
select extensions.has_table('public', 'telegram_link_tokens', 'Telegram link tokens table exists');

select extensions.ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.reminders'::regclass), 'reminders has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.reminder_occurrences'::regclass), 'occurrences has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.notification_logs'::regclass), 'notification logs has RLS enabled');

select extensions.ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reminders' and policyname = 'reminders_select_own'), 'reminder ownership policy exists');
select extensions.ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reminder_occurrences' and policyname = 'occurrences_select_own'), 'occurrence ownership policy exists');
select extensions.ok(to_regprocedure('public.next_occurrence_at(uuid,timestamptz)') is not null, 'recurrence function exists');
select extensions.ok(to_regprocedure('public.claim_due_occurrences(integer)') is not null, 'atomic claim function exists');
select extensions.ok(to_regprocedure('public.apply_user_occurrence_action(uuid,text,integer)') is not null, 'authenticated occurrence action exists');
select extensions.ok(to_regprocedure('public.apply_telegram_occurrence_action(text,uuid,text,integer)') is not null, 'Telegram ownership-checked action exists');
select extensions.ok(to_regprocedure('public.update_reminder_schedule(uuid,text,text,text,text,text,text,timestamptz,timestamptz,jsonb)') is not null, 'transactional reminder schedule update exists');
select extensions.ok(to_regprocedure('public.retry_failed_occurrence(uuid)') is not null, 'failed occurrence retry function exists');

select * from extensions.finish();
rollback;
