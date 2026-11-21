# CLAUDE.md

Maison Adé: a booking app for a MADE-UP luxury hair and beauty salon in Lekki, Lagos.
Curriculum project 4 ("booking app with WhatsApp/email reminders": scheduling, workflows, notifications).
The owner's curriculum lives in `../animated website/CURRICULUM.md`; project 1-2 (Lash Magic) is in `../animated website`.

## Status
- Phase 1 (setup + design) done: homepage with menu, stylists, hours; `/book` is a placeholder.
- Live at https://maison-ade.vercel.app (GitHub zayaliya16-gif/maison-ade, Vercel auto-deploys from `main`).
- Next: phase 2 availability engine (staff, services, working hours, time off, bookings; overlap-proof in the DB), then
  3 customer booking, 4 manage links + staff calendar, 5 email (Resend) + WhatsApp (Meta Cloud API test number) with a message log,
  6 automatic reminders every 15 min (retries, never twice), 7 tests + security review + README + live.
- "Done" rule for project 3+: input checks, error handling, tests, security checks, README.
- Plan before building each phase; the owner says "start". Explain in plain language; the owner is learning.

## Commands
- `npm run dev` (localhost:3000), `npm run build`, `npm start`, `npm test` (Node test runner, `tests/`)

## Architecture
- Next.js 15 App Router (`src/app`) + React 19, Tailwind v4 via `@tailwindcss/postcss`, pinned to 4.3.3 (4.3.4+ needs Node 20.19+; this machine has Node 20.12).
- Fonts self-hosted in `src/app/fonts` via `next/font/local` (Fraunces display, Hanken Grotesk body): builds never fetch Google Fonts.
- Design tokens in `src/app/globals.css` `@theme`: bone, linen, ink, emerald, emerald-soft, brass, brass-light. Light-first; emerald blocks for contrast.
  Custom CSS (`.btn*`) must stay in `@layer components` so utilities like `hidden` win.
- Signature: `Wordmark` draws the é accent as a brass crown (Adé = crown in Yoruba). Keep it the one bold element; everything else quiet.
- All salon data (services with minutes + priceKobo, staff and which services they do, opening hours) lives in `src/config/salon.js`. Everything is DEMO data; the footer says the salon is made up.
- Money in kobo; display with `naira()` in `src/lib/format.js` (hand-formatted so server and browser match).
- Database: Supabase, server-only. `db()` in `src/lib/supabase.js` uses `SUPABASE_URL` + `SUPABASE_SECRET_KEY` from `.env.local` (template `.env.example`); `npm run db:check` tests it. Browsers never get a Supabase key.
- Times are Africa/Lagos (UTC+1 all year, no DST).
- Security headers in `next.config.mjs`; Vercel functions in `lhr1` (`vercel.json`).
- Git commits use the GitHub noreply email (repo-local config) so Vercel Hobby deploys them.
