-- ─────────────────────────────────────────────────────────────
-- Maison Adé, phase 6: delivery tracking + the 15-minute reminder clock.
-- Run once in Supabase: SQL Editor > New query > paste this file >
--   REPLACE  PASTE_CRON_SECRET_HERE  below with the CRON_SECRET from your .env.local  > Run.
-- (Never commit the real secret into this file: only paste it in the Supabase editor.)
-- ─────────────────────────────────────────────────────────────

-- 1. What WhatsApp tells us after sending: delivered to the phone, read, or failed (and why)
alter table public.messages
  add column delivery     text check (delivery in ('delivered', 'read', 'failed')),
  add column delivered_at timestamptz,
  add column read_at      timestamptz;
create index messages_provider on public.messages (provider_id) where provider_id is not null;

-- 2. The clock. Vercel's free plan only runs jobs once a day, so Supabase does it every 15 minutes:
--    pg_cron = the timer, pg_net = lets the database call our website.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- The secret that proves the call really comes from our database (kept encrypted in Supabase Vault)
select vault.create_secret('PASTE_CRON_SECRET_HERE', 'maison_ade_cron_secret', 'Calls /api/cron/reminders');

-- Every 15 minutes: ask the website to send due reminders and retry failed messages
select cron.schedule(
  'maison-ade-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://maison-ade.vercel.app/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'maison_ade_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- To check it's running later:   select * from cron.job_run_details order by start_time desc limit 10;
-- To see what the website answered: select status_code, content from net._http_response order by created desc limit 10;
-- To stop it:                    select cron.unschedule('maison-ade-reminders');
