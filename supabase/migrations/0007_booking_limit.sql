-- ─────────────────────────────────────────────────────────────
-- Maison Adé, phase 7: limit junk bookings from one place (max 5 an hour).
-- Run once in Supabase: SQL Editor > New query > paste this file > Run.
-- ─────────────────────────────────────────────────────────────

-- A scrambled fingerprint of where the booking came from (never the address itself).
-- Cleared automatically after 2 days by the reminder clock: it's only needed for the 1-hour limit.
alter table public.bookings
  add column ip_hash text check (ip_hash is null or length(ip_hash) = 64);
create index bookings_ip_recent on public.bookings (ip_hash, created_at) where ip_hash is not null;
