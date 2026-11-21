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
- Next: 4 manage links + staff calendar, 5 email (Resend) + WhatsApp (Meta Cloud API test number) with a message log,
  6 automatic reminders every 15 min (retries, never twice), 7 tests + security review + README + live.
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
- Database: Supabase, server-only. `db()` in `src/lib/supabase.js` uses `SUPABASE_URL` + `SUPABASE_SECRET_KEY` from `.env.local` (template `.env.example`); `npm run db:check` tests it. Browsers never get a Supabase key.
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
