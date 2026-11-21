# CLAUDE.md

Maison Adé: a booking app for a MADE-UP luxury hair and beauty salon in Lekki, Lagos.
Curriculum project 4 ("booking app with WhatsApp/email reminders": scheduling, workflows, notifications).
The owner's curriculum lives in `../animated website/CURRICULUM.md`; project 1-2 (Lash Magic) is in `../animated website`.

## Status
- Phase 1 (setup + design) done: homepage with menu, stylists, hours.
- Live at https://maison-ade.vercel.app (GitHub zayaliya16-gif/maison-ade, Vercel auto-deploys from `main`).
- Phase 2 (availability engine) done: tables + overlap-proof bookings in Supabase, `findSlots()`, 21 tests passing.
- Phase 3 (customer booking) done: `/book` 4 steps (state in URL params), server action `src/app/book/actions.js` →
  `createBooking()` in `src/lib/booking.js` (re-checks slot, 3 upcoming per phone, "any" = least busy, retries next stylist on 23P01).
  Private page `/b/[token]` (+ `/calendar` .ics): random 32-byte token, only its SHA-256 stored. Input checks in `src/lib/booking-input.js`.
  Tests use phone `+999...` (not a real country) and clean up. `npm test` runs with `--conditions=react-server` so server-only code is testable.
- Phase 4 (manage + staff) done: `/b/[token]` cancel + `/b/[token]/change` move (one UPDATE, same service + stylist,
  `ignoreBookingId` so it can overlap its own old time; online until `changeCutoffMinutes` = 2h before).
  `/staff` diary (day view, time off with clash warning, staff cancel) behind shared `STAFF_PASSWORD` (12+ chars, env var):
  signed 12h cookie (`src/lib/session.js`, key = hash of SUPABASE_SECRET_KEY + password), lockout 5 fails / 15 min per hashed IP
  (`src/lib/login-attempts.js`, table `login_attempts`). Every staff page/action calls `requireStaff()`. Day/time picker shared: `SlotPicker`.
  Tests run files one at a time (`--test-concurrency=1`): DB tests book the same stylists and would clash.
- Phase 5 (messages) done: `src/lib/messages/` = templates.js (wording, pure), providers.js (Resend + Meta Cloud API v25 via fetch,
  plain-word errors, retry vs permanent), outbox.js (queue → claim → send → log in `messages`; unique per booking+channel+kind+time;
  claim via status+attempts check so never twice; MAX_ATTEMPTS 5). Actions call `after(() => notify(id, kind))`.
  Links in messages: `linkTokenFor(id)` = HMAC of booking id with SUPABASE_SECRET_KEY (rotating it breaks links). `/staff/messages` log + retry.
  Free test limits: Resend only to the account's own email; WhatsApp test number only to verified numbers, free text only within 24h
  of the customer writing (templates via WHATSAPP_USE_TEMPLATES=on once approved). `npm run msg:test -- <phone> <email>` sends one real test.
- Phase 6 (reminders) done: Supabase pg_cron (Vercel Hobby cron is daily only) POSTs `/api/cron/reminders` every 15 min with
  `Bearer CRON_SECRET` (secret in Supabase Vault; migration 0006 keeps a placeholder, never commit the real one).
  `runReminders()` in `src/lib/reminders.js`: reminder_day (24h→6h before, if booked ≥24h ahead), reminder_soon (2h→30min, if booked ≥3h ahead),
  retries with backoff (`retryDue`), stuck 'sending' >10 min: email retried (Resend idempotency), WhatsApp NOT (never twice).
  `deliver()` skips stale messages (cancelled / moved / time passed). WhatsApp webhook `/api/webhooks/whatsapp` (signed with
  WHATSAPP_APP_SECRET, verify token WHATSAPP_WEBHOOK_VERIFY_TOKEN) fills messages.delivery. Meta steps: `docs/whatsapp-setup.md`.
- Next: 7 tests + security review + README + live.
- "Done" rule for project 3+: input checks, error handling, tests, security checks, README.
- Plan before building each phase; the owner says "start". Explain in plain language; the owner is learning.

## Commands
- `npm run dev` (localhost:3000), `npm run build`, `npm start`, `npm test` (Node test runner, `tests/`)

## Architecture
- Next.js 15 App Router (`src/app`) + React 19, Tailwind v4 via `@tailwindcss/postcss`. Node 22 (`engines` in package.json, so Vercel matches).
- Fonts self-hosted in `src/app/fonts` via `next/font/local` (Fraunces display, Hanken Grotesk body): builds never fetch Google Fonts.
- Design tokens in `src/app/globals.css` `@theme`: bone, linen, ink, emerald, emerald-soft, brass, brass-light. Light-first; emerald blocks for contrast.
  Custom CSS (`.btn*`) must stay in `@layer components` so utilities like `hidden` win.
- Signature: `Wordmark` draws the é accent as a brass crown (Adé = crown in Yoruba). Keep it the one bold element; everything else quiet.
- All salon data (services with minutes + priceKobo, staff and which services they do, opening hours) lives in `src/config/salon.js`. Everything is DEMO data; the footer says the salon is made up.
- Money in kobo; display with `naira()` in `src/lib/format.js` (hand-formatted so server and browser match).
- Database: Supabase, server-only. `db()` in `src/lib/supabase.js` uses `SUPABASE_URL` + `SUPABASE_SECRET_KEY` from `.env.local` (template `.env.example`); `npm run db:check` tests it locally; live: https://maison-ade.vercel.app/api/health (yes/no only, never values). Browsers never get a Supabase key.
  Vercel env vars only apply after a NEW deploy (push an empty commit).
  Schema in `supabase/migrations/*.sql` (owner pastes into the Supabase SQL Editor; no CLI). RLS on, no policies, anon/authenticated revoked.
  This project does NOT auto-grant new tables: every new table needs `grant ... to service_role` (see 0002) or the server gets "permission denied".
  `bookings.no_double_booking` exclusion constraint makes overlaps impossible in the DB (error 23P01 = slot taken).
  `npm run db:seed` syncs services/staff/staff_services from `salon.js`; working hours only on first run (DB is the source after).
- Availability: `src/lib/availability.js` is pure (no DB, fully unit-tested); `src/lib/schedule.js` `findSlots()` loads a day from the DB and calls it.
  Rules (`bookingRules` in salon.js): 15-min steps, 2h notice, 60 days ahead, service must end by close.
  Tests: `tests/availability.test.js` (pure) and `tests/database.test.js` (real DB, 2099 dates, cleans up after itself).
- Times are Africa/Lagos (UTC+1 all year, no DST).
- Security headers in `next.config.mjs`; Vercel functions in `dub1` Dublin (`vercel.json`), next to Supabase in eu-west-1 Ireland: keep them together.
- Git commits use the GitHub noreply email (repo-local config) so Vercel Hobby deploys them.
