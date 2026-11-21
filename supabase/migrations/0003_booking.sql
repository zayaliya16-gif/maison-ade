-- ─────────────────────────────────────────────────────────────
-- Maison Adé, phase 3: customer booking.
-- Run once in Supabase: SQL Editor > New query > paste this file > Run.
-- ─────────────────────────────────────────────────────────────

-- What the customer agreed to be reminded by (WhatsApp needs a clear yes before we message anyone)
alter table public.bookings
  add column whatsapp_opt_in boolean not null default false,
  add column email_opt_in    boolean not null default false,
  add constraint email_opt_in_needs_email check (not email_opt_in or customer_email is not null);

-- Fast lookups for "how many upcoming bookings does this phone number have?" (the limit of 3)
create index bookings_phone_upcoming on public.bookings (customer_phone, starts_at) where status = 'confirmed';

-- Fast lookups for a stylist's bookings in a date range
create index bookings_staff_time on public.bookings (staff_id, starts_at);

-- (No new tables, so the service_role permission from 0002 already covers these columns.)
