-- ─────────────────────────────────────────────────────────────
-- Maison Adé, phase 5: the message log (email + WhatsApp).
-- Run once in Supabase: SQL Editor > New query > paste this file > Run.
-- ─────────────────────────────────────────────────────────────

-- Every message is written here BEFORE it's sent, then updated with what happened.
create table public.messages (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references public.bookings(id) on delete cascade,
  channel        text not null check (channel in ('email', 'whatsapp')),
  kind           text not null check (kind in ('confirmed', 'moved', 'cancelled', 'reminder_day', 'reminder_soon')),
  for_starts_at  timestamptz not null, -- the appointment time this message is about (a moved booking gets fresh messages)
  recipient      text not null check (length(recipient) <= 254),
  status         text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts       int  not null default 0 check (attempts >= 0),
  provider_id    text check (length(provider_id) <= 200), -- Resend / Meta's id for the message
  error          text check (length(error) <= 1000),        -- why it failed or was skipped, in plain words
  created_at     timestamptz not null default now(),
  last_tried_at  timestamptz,
  sent_at        timestamptz,

  -- NEVER TWICE: one message per booking, channel, kind and appointment time.
  -- A second try to create the same message is refused by the database itself.
  constraint one_message_each unique (booking_id, channel, kind, for_starts_at)
);
create index messages_recent on public.messages (created_at desc);
create index messages_retry on public.messages (status, last_tried_at) where status in ('pending', 'failed');

-- Same lockdown as every other table
alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select, insert, update, delete on public.messages to service_role;
