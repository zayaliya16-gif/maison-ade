import Link from 'next/link';
import Wordmark from '@/components/Wordmark.jsx';
import SlotPicker from '@/components/SlotPicker.jsx';
import BookingForm from './BookingForm.jsx';
import { categories, services, staff } from '@/config/salon.js';
import { readPickerParams } from '@/lib/picker-params.js';
import { findSlotsForDays } from '@/lib/schedule.js';
import { clock, duration, longDate, naira } from '@/lib/format.js';

export const metadata = { title: 'Book a visit | Maison Adé' };

// ─────────────────────────────────────────────────────────────
// The booking page. Every choice lives in the address bar:
//   /book?service=silk-press&staff=tolu&week=2026-12-01&date=2026-12-05&time=10:30
// so the back button, refreshing and sharing all just work, even without JavaScript.
// Anything in the address that isn't valid is ignored, never trusted.
// ─────────────────────────────────────────────────────────────

const one = (v) => (Array.isArray(v) ? v[0] : v) ?? '';

/** Builds a /book address from the current choices plus changes */
function href(choices, changes = {}) {
  const all = { ...choices, ...changes };
  const params = new URLSearchParams();
  for (const key of ['service', 'staff', 'week', 'date', 'time']) if (all[key]) params.set(key, all[key]);
  const query = params.toString();
  return query ? `/book?${query}` : '/book';
}

export default async function BookPage({ searchParams }) {
  const q = await searchParams;

  // 1. Service
  const service = services.find((s) => s.id === one(q.service));
  // 2. Stylist: someone who does this service, or "any"
  const stylists = service ? staff.filter((p) => p.services.includes(service.id)) : [];
  const staffParam = one(q.staff);
  const staffChoice = service && (staffParam === 'any' || stylists.some((p) => p.id === staffParam)) ? staffParam : null;
  const stylist = stylists.find((p) => p.id === staffChoice);
  // 3. Day and 4. time
  const picker = readPickerParams(q);
  const date = staffChoice ? picker.date : null;

  // Free slots for the week on screen (one trip to the database for all 7 days)
  const slotsByDay = staffChoice
    ? await findSlotsForDays({ serviceId: service.id, staffId: staffChoice === 'any' ? undefined : staffChoice, dates: picker.weekDays })
    : new Map();
  const slot = date ? (slotsByDay.get(date) ?? []).find((s) => s.time === picker.time) : null;
  const timeGone = Boolean(date && picker.time && !slot);

  const choices = { service: service?.id, staff: staffChoice, week: picker.week, date, time: slot?.time };
  const step = !service ? 1 : !staffChoice ? 2 : !slot ? 3 : 4;

  return (
    <>
      <header className="border-b border-linen">
        <div className="mx-auto flex h-[72px] max-w-[46rem] items-center justify-between px-5">
          <Link href="/" className="text-2xl text-emerald"><Wordmark /></Link>
          <Link href="/" className="text-sm text-ink/65 hover:text-ink">Back to the salon</Link>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[46rem] px-5 pb-24 pt-10 sm:pt-14">
        <p className="text-sm text-brass">Step {step} of 4</p>
        <h1 className="mt-2 font-display text-[clamp(2.2rem,6vw,3.4rem)] font-[350] leading-none text-emerald">
          {['Choose a service', 'Choose a stylist', 'Pick a day and time', 'Your details'][step - 1]}
        </h1>

        {/* What they've chosen so far, each with a way back */}
        {service && (
          <dl className="mt-8 divide-y divide-linen rounded-[14px] border border-linen bg-white/40">
            <Summary label="Service" value={`${service.name} · ${duration(service.minutes)} · ${naira(service.priceKobo)}`} change={href({})} />
            {staffChoice && <Summary label="Stylist" value={stylist?.name ?? 'Any stylist'} change={href({ service: service.id })} />}
            {slot && <Summary label="When" value={`${longDate(date)}, ${clock(slot.time)}`} change={href(choices, { time: null })} />}
          </dl>
        )}

        {step === 1 && (
          <div className="mt-10 space-y-12">
            {categories.map((c) => (
              <section key={c.id} aria-labelledby={`cat-${c.id}`}>
                <h2 id={`cat-${c.id}`} className="border-b border-linen pb-3 font-display text-2xl italic text-brass">{c.label}</h2>
                <ul className="mt-3 space-y-2">
                  {services.filter((s) => s.category === c.id).map((s) => (
                    <li key={s.id}>
                      <Option href={href({}, { service: s.id })} title={s.name} detail={`${duration(s.minutes)} · ${s.summary}`} aside={naira(s.priceKobo)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {step === 2 && (
          <ul className="mt-10 space-y-2">
            <li>
              <Option href={href({ service: service.id }, { staff: 'any' })} title="Any stylist" detail="The widest choice of times. We’ll match you with whoever is free." aside="★" />
            </li>
            {stylists.map((p) => (
              <li key={p.id}>
                <Option href={href({ service: service.id }, { staff: p.id })} title={p.name} detail={`${p.role}. ${p.bio}`} />
              </li>
            ))}
          </ul>
        )}

        {step === 3 && (
          <SlotPicker
            {...picker}
            date={date}
            slotsByDay={slotsByDay}
            link={(changes) => href(choices, changes)}
            notice={timeGone ? `Sorry, ${clock(picker.time)} is no longer free. Please pick another time.` : null}
            emptyWeekHint="Try the next week, or choose “Any stylist” for more times."
          />
        )}

        {step === 4 && (
          <BookingForm
            choice={{ service: service.id, staff: staffChoice, date, time: slot.time }}
            backToTimes={href(choices, { time: null })}
          />
        )}
      </main>
    </>
  );
}

function Summary({ label, value, change }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <dt className="text-xs uppercase tracking-wide text-ink/50">{label}</dt>
        <dd className="mt-0.5 text-emerald">{value}</dd>
      </div>
      <Link href={change} className="shrink-0 text-sm text-brass underline-offset-4 hover:underline">
        Change<span className="sr-only"> {label.toLowerCase()}</span>
      </Link>
    </div>
  );
}

function Option({ href: to, title, detail, aside }) {
  return (
    <Link href={to} className="group flex items-start justify-between gap-5 rounded-[14px] border border-linen bg-white/50 px-5 py-4 transition-colors hover:border-emerald/40">
      <span className="min-w-0">
        <span className="block text-lg text-emerald">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-ink/60">{detail}</span>
      </span>
      {aside && <span className="shrink-0 font-display text-lg text-brass">{aside}</span>}
    </Link>
  );
}
