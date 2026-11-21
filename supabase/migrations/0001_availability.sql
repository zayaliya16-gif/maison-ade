-- ─────────────────────────────────────────────────────────────
-- Maison Adé, phase 2: the tables behind availability and bookings.
-- Run once in Supabase: SQL Editor > New query > paste this file > Run.
-- ─────────────────────────────────────────────────────────────

-- Lets one rule compare "same stylist" (=) and "overlapping times" (&&) together
create extension if not exists btree_gist;

-- What the salon offers. Copied from src/config/salon.js by `npm run db:seed`.
create table public.services (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  name        text not null check (length(name) between 1 and 100),
  minutes     int  not null check (minutes between 15 and 600 and minutes % 15 = 0),
  price_kobo  int  not null check (price_kobo >= 0),
  active      boolean not null default true
);

-- The stylists. Also copied from salon.js.
create table public.staff (
  id      text primary key check (id ~ '^[a-z0-9-]+$'),
  name    text not null check (length(name) between 1 and 100),
  active  boolean not null default true
);

-- Which stylist does which service
create table public.staff_services (
  staff_id    text not null references public.staff(id) on delete cascade,
  service_id  text not null references public.services(id) on delete cascade,
  primary key (staff_id, service_id)
);

-- Each stylist's usual hours, one shift per weekday (0 = Sunday). No row = day off.
create table public.working_hours (
  staff_id  text not null references public.staff(id) on delete cascade,
  weekday   smallint not null check (weekday between 0 and 6),
  starts    time not null,
  ends      time not null,
  primary key (staff_id, weekday),
  check (ends > starts)
);

-- Holidays, sick days, blocked hours
create table public.time_off (
  id         uuid primary key default gen_random_uuid(),
  staff_id   text not null references public.staff(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text check (length(reason) <= 200),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index time_off_staff_time on public.time_off (staff_id, starts_at);

-- Appointments
create table public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  staff_id           text not null references public.staff(id),
  service_id         text not null references public.services(id),
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  status             text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  customer_name      text not null check (length(customer_name) between 1 and 100),
  customer_phone     text not null check (customer_phone ~ '^\+[1-9][0-9]{7,14}$'), -- international format, e.g. +2348012345678
  customer_email     text check (customer_email is null or (length(customer_email) <= 254 and customer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  price_kobo         int  not null check (price_kobo >= 0), -- price at the time of booking, so later price changes don't rewrite history
  manage_token_hash  text not null unique, -- for the "change or cancel" link (phase 4); only a hash is stored
  created_at         timestamptz not null default now(),
  cancelled_at       timestamptz,
  check (ends_at > starts_at),

  -- THE IMPORTANT RULE: a stylist can never have two confirmed bookings whose times overlap.
  -- '[)' means a 10:00-11:00 booking and an 11:00-12:00 booking touch but don't clash.
  -- Postgres enforces this itself, so two people clicking "Book" at the same moment can't both win.
  constraint no_double_booking exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'confirmed')
);

-- Lock everything down: Row Level Security on with no policies means the public keys can read and write nothing.
-- Only our server (using the secret key) gets in.
alter table public.services       enable row level security;
alter table public.staff          enable row level security;
alter table public.staff_services enable row level security;
alter table public.working_hours  enable row level security;
alter table public.time_off       enable row level security;
alter table public.bookings       enable row level security;

revoke all on public.services, public.staff, public.staff_services,
              public.working_hours, public.time_off, public.bookings
  from anon, authenticated;
