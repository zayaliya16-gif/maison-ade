import Link from 'next/link';
import Wordmark from '@/components/Wordmark.jsx';
import BookingForm from './BookingForm.jsx';
import { bookingRules, categories, services, staff } from '@/config/salon.js';
import { addDays, lagosToday, parseDate } from '@/lib/availability.js';
import { findSlotsForDays } from '@/lib/schedule.js';
import { clock, dayParts, duration, longDate, naira, shortDate } from '@/lib/format.js';

export const metadata = { title: 'Book a visit | Maison Adé' };

// ─────────────────────────────────────────────────────────────
// The booking page. Every choice lives in the address bar:
//   /book?service=silk-press&staff=tolu&week=2026-12-01&date=2026-12-05&time=10:30
// so the back button, refreshing and sharing all just work, even without JavaScript.
// Anything in the address that isn't valid is ignored, never trusted.
// ─────────────────────────────────────────────────────────────

const one = (v) => (Array.isArray(v) ? v[0] : v) ?? '';
const isDate = (v) => { try { parseDate(v); return true; } catch { return false; } };

/** Builds a /book address from the current choices plus changes */
function href(choices, changes = {}) {
  const all = { ...choices, ...changes };
  const params = new URLSearchParams();
  for (const key of ['service', 'staff', 'week', 'date', 'time']) if (all[key]) params.set(key, all[key]);
  return `/book?${params}`;
}

export default async function BookPage({ searchParams }) {
  const q = await searchParams;
  const today = lagosToday();
  const lastDay = addDays(today, bookingRules.maxDaysAhead);
  const inRange = (d) => isDate(d) && d >= today && d <= lastDay;

  // 1. Service
  const service = services.find((s) => s.id === one(q.service));
  // 2. Stylist: someone who does this service, or "any"
  const stylists = service ? staff.filter((p) => p.services.includes(service.id)) : [];
  const staffParam = one(q.staff);
  const staffChoice = service && (staffParam === 'any' || stylists.some((p) => p.id === staffParam)) ? staffParam : null;
  const stylist = stylists.find((p) => p.id === staffChoice);
  // 3. Day: within the bookable range; the week shown always contains it
  const date = staffChoice && inRange(one(q.date)) ? one(q.date) : null;
  let week = inRange(one(q.week)) ? one(q.week) : (date ?? today);
  if (date && (date < week || date > addDays(week, 6))) week = date;
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i)).filter((d) => d <= lastDay);

  // Free slots for the week on screen (one trip to the database for all 7 days)
  const slotsByDay = staffChoice
    ? await findSlotsForDays({ serviceId: service.id, staffId: staffChoice === 'any' ? undefined : staffChoice, dates: weekDays })
    : new Map();
  const daySlots = date ? slotsByDay.get(date) ?? [] : [];
  // 4. Time: must still be free right now
  const timeParam = one(q.time);
  const slot = date ? daySlots.find((s) => s.time === timeParam) : null;
  const timeGone = Boolean(date && timeParam && !slot);

  const choices = { service: service?.id, staff: staffChoice, week, date, time: slot?.time };
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
            <Summary label="Service" value={`${service.name} · ${duration(service.minutes)} · ${naira(service.priceKobo)}`} change={href({}, {})} />
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
          <section className="mt-10" aria-label="Day and time">
            {timeGone && (
              <p role="alert" className="mb-6 rounded-[14px] bg-brass-light/40 px-5 py-4 text-emerald">
                Sorry, {clock(timeParam)} is no longer free. Please pick another time.
              </p>
            )}

            {/* The week, with arrows to move through the 60 bookable days */}
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-emerald">{weekLabel(weekDays)}</h2>
              <div className="flex gap-2">
                <WeekArrow href={week > today ? href(choices, { week: maxDate(today, addDays(week, -7)), date: null, time: null }) : null} label="Earlier week" dir="‹" />
                <WeekArrow href={addDays(week, 7) <= lastDay ? href(choices, { week: addDays(week, 7), date: null, time: null }) : null} label="Later week" dir="›" />
              </div>
            </div>
            <ul className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekDays.map((d) => {
                const p = dayParts(d);
                const free = (slotsByDay.get(d) ?? []).length > 0;
                const selected = d === date;
                const inner = (
                  <>
                    <span className="text-[0.7rem] uppercase tracking-wide">{p.weekday}</span>
                    <span className="font-display text-xl leading-none sm:text-2xl">{p.day}</span>
                  </>
                );
                const base = 'flex h-[4.5rem] flex-col items-center justify-center gap-1 rounded-[12px] border';
                return (
                  <li key={d}>
                    {free ? (
                      <Link href={href(choices, { date: d, time: null })} aria-current={selected ? 'date' : undefined}
                        aria-label={`${longDate(d)}, ${(slotsByDay.get(d) ?? []).length} times free`}
                        className={`${base} ${selected ? 'border-emerald bg-emerald text-bone' : 'border-linen bg-white/50 text-emerald hover:border-emerald/40'}`}>
                        {inner}
                      </Link>
                    ) : (
                      <span aria-label={`${longDate(d)}, no times free`} className={`${base} border-transparent text-ink/30`}>{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>

            {!date && (
              <p className="mt-8 text-ink/65">
                {weekDays.some((d) => (slotsByDay.get(d) ?? []).length)
                  ? 'Choose a day to see the free times.'
                  : 'Nothing is free this week. Try the next week, or choose “Any stylist” for more times.'}
              </p>
            )}

            {date && (
              <div className="mt-10 space-y-8">
                <h2 className="font-display text-2xl text-emerald">{longDate(date)}</h2>
                {daySlots.length === 0 && <p className="text-ink/65">Nothing is free that day. Please choose another.</p>}
                {[['Morning', '00:00', '12:00'], ['Afternoon', '12:00', '17:00'], ['Evening', '17:00', '24:00']].map(([label, from, to]) => {
                  const group = daySlots.filter((s) => s.time >= from && s.time < to);
                  if (group.length === 0) return null;
                  return (
                    <section key={label} aria-label={label}>
                      <h3 className="text-sm text-ink/60">{label}</h3>
                      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {group.map((s) => (
                          <li key={s.time}>
                            <Link href={href(choices, { time: s.time })}
                              className="flex h-11 items-center justify-center rounded-full border border-linen bg-white/50 text-[0.95rem] text-emerald hover:border-emerald/40">
                              {clock(s.time)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </section>
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

function WeekArrow({ href: to, label, dir }) {
  const base = 'flex size-11 items-center justify-center rounded-full border text-xl';
  return to
    ? <Link href={to} aria-label={label} className={`${base} border-linen text-emerald hover:border-emerald/40`}>{dir}</Link>
    : <span aria-hidden="true" className={`${base} border-transparent text-ink/20`}>{dir}</span>;
}

function weekLabel(days) {
  const first = shortDate(days[0]);
  const last = shortDate(days.at(-1));
  return days.length > 1 ? `${first} – ${last}` : first;
}

const maxDate = (a, b) => (a > b ? a : b);
