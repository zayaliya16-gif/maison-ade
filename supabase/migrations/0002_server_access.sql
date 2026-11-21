-- ─────────────────────────────────────────────────────────────
-- Maison Adé: let our server (the secret key = "service_role") use the tables.
-- Newer Supabase projects don't grant this automatically for tables made in SQL.
-- The public keys (anon, authenticated) stay locked out.
-- Run once in Supabase: SQL Editor > New query > paste this file > Run.
-- ─────────────────────────────────────────────────────────────

grant usage on schema public to service_role;

grant select, insert, update, delete
  on public.services, public.staff, public.staff_services,
     public.working_hours, public.time_off, public.bookings
  to service_role;
