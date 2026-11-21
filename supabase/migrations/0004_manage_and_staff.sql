-- ─────────────────────────────────────────────────────────────
-- Maison Adé, phase 4: change/cancel links and the staff calendar.
-- Run once in Supabase: SQL Editor > New query > paste this file > Run.
-- ─────────────────────────────────────────────────────────────

-- Who cancelled, and when a booking was last moved to a new time
alter table public.bookings
  add column cancelled_by text check (cancelled_by in ('customer', 'staff')),
  add column moved_at     timestamptz;

-- Staff login attempts, so password guessing can be slowed down (5 wrong tries = 15-minute pause).
-- Stores a scrambled fingerprint of the address, never the address itself.
create table public.login_attempts (
  id           bigint generated always as identity primary key,
  ip_hash      text not null check (length(ip_hash) = 64),
  succeeded    boolean not null,
  attempted_at timestamptz not null default now()
);
create index login_attempts_recent on public.login_attempts (ip_hash, attempted_at);

-- Same lockdown as every other table: public keys get nothing, only our server gets in
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;
grant select, insert, delete on public.login_attempts to service_role;

-- Fast lookups for the staff day view
create index time_off_time on public.time_off (starts_at, ends_at);
