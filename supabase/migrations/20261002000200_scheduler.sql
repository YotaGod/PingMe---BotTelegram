create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'smart-reminder-worker'
  ) then
    perform cron.schedule(
      'smart-reminder-worker',
      '* * * * *',
      $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'smart_reminder_worker_url'),
          headers := jsonb_build_object(
            'content-type', 'application/json',
            'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'smart_reminder_worker_secret')
          ),
          body := '{}'::jsonb
        );
      $job$
    );
  end if;
end;
$$;