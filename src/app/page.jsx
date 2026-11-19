import Link from 'next/link';
import Wordmark, { Crown } from '@/components/Wordmark.jsx';
import { categories, salon, services, staff } from '@/config/salon.js';
import { WEEKDAYS, clock, duration, naira } from '@/lib/format.js';

const LONGEST = Math.max(...services.map((s) => s.minutes));
const wrap = 'mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-12';

// Mon–Sun order for the hours list, grouping identical days
function hoursRows() {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const rows = [];
  for (const d of order) {
    const h = salon.hours[d];
    const text = h ? `${clock(h.open)} – ${clock(h.close)}` : 'Closed';
    const last = rows[rows.length - 1];
    if (last && last.text === text) last.to = d; else rows.push({ from: d, to: d, text });
  }
  return rows.map((r) => ({ days: r.from === r.to ? WEEKDAYS[r.from] : `${WEEKDAYS[r.from]} to ${WEEKDAYS[r.to]}`, text: r.text }));
}

export default function Home() {
  return (
    <>
      <header className="border-b border-linen">
        <div className={`${wrap} flex h-[72px] items-center justify-between`}>
          <Link href="/" className="text-2xl text-emerald"><Wordmark /></Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <a href="#menu" className="hidden rounded-full px-4 py-2 text-[0.95rem] text-ink/75 hover:text-ink sm:inline-block">Services</a>
            <a href="#stylists" className="hidden rounded-full px-4 py-2 text-[0.95rem] text-ink/75 hover:text-ink sm:inline-block">Stylists</a>
            <a href="#visit" className="hidden rounded-full px-4 py-2 text-[0.95rem] text-ink/75 hover:text-ink md:inline-block">Visit</a>
            <Link href="/book" className="btn btn-emerald ml-2 min-h-11! px-5!">Book a visit</Link>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* ── Hero: the name is the picture ── */}
        <section className={`${wrap} pb-20 pt-20 md:pb-28 md:pt-28`}>
          <h1 className="text-emerald">
            <Wordmark size="lg" animate className="text-[clamp(3.6rem,13vw,11.5rem)] font-[350] leading-[0.92] tracking-[-0.02em]" />
          </h1>
          <div className="mt-10 md:mt-14">
            <p className="font-display text-[clamp(1.6rem,3vw,2.4rem)] italic leading-tight text-emerald">{salon.tagline}</p>
            <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-ink/75">{salon.intro}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/book" className="btn btn-emerald">Book a visit</Link>
              <a href="#menu" className="btn btn-line text-emerald">See the menu</a>
            </div>
          </div>
        </section>

        {/* ── The menu: every service with its real length ── */}
        <section id="menu" aria-labelledby="menu-title" className="bg-emerald py-20 text-bone md:py-28">
          <div className={wrap}>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 id="menu-title" className="font-display text-[clamp(2.4rem,5vw,4rem)] font-[350] leading-none">The menu</h2>
              <p className="max-w-[40ch] text-bone/70">The bar shows how long each appointment takes, so you can plan your day around it.</p>
            </div>
            <div className="mt-14 grid gap-14 lg:grid-cols-3 lg:gap-10">
              {categories.map((c) => (
                <div key={c.id}>
                  <h3 className="border-b border-brass-light/30 pb-3 font-display text-2xl italic text-brass-light">{c.label}</h3>
                  <ul className="mt-2 divide-y divide-bone/10">
                    {services.filter((s) => s.category === c.id).map((s) => (
                      <li key={s.id} className="py-5">
                        <div className="flex items-baseline justify-between gap-4">
                          <p className="text-lg text-bone">{s.name}</p>
                          <p className="shrink-0 font-display text-lg text-brass-light">{naira(s.priceKobo)}</p>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-bone/60">{s.summary}</p>
                        <div className="mt-3 flex items-center gap-3">
                          <span className="h-[3px] rounded-full bg-brass-light/80" style={{ width: `${Math.max(8, (s.minutes / LONGEST) * 100)}%` }} aria-hidden="true" />
                          <span className="shrink-0 text-xs text-bone/60">{duration(s.minutes)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stylists ── */}
        <section id="stylists" aria-labelledby="stylists-title" className={`${wrap} py-20 md:py-28`}>
          <h2 id="stylists-title" className="font-display text-[clamp(2.4rem,5vw,4rem)] font-[350] leading-none text-emerald">Choose your stylist</h2>
          <p className="mt-4 max-w-[52ch] text-lg text-ink/70">Book with someone you love, or pick “anyone” and we’ll match you with whoever is free.</p>
          <ul className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {staff.map((p) => (
              <li key={p.id}>
                <div className="flex aspect-[4/5] items-center justify-center rounded-t-[999px] rounded-b-[14px] bg-linen">
                  <span className="font-display text-[5.5rem] font-[300] italic text-emerald/80">{p.name[0]}</span>
                </div>
                <p className="mt-5 font-display text-2xl text-emerald">{p.name}</p>
                <p className="text-sm text-brass">{p.role}</p>
                <p className="mt-3 leading-relaxed text-ink/70">{p.bio}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── How booking works: a real sequence, so it's numbered ── */}
        <section aria-labelledby="how-title" className="border-y border-linen bg-linen/40 py-20 md:py-24">
          <div className={wrap}>
            <h2 id="how-title" className="font-display text-[clamp(2rem,4vw,3.2rem)] font-[350] leading-none text-emerald">Booking takes a minute</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-4">
              {[
                ['Choose a service', 'Each one shows its price and how long it takes.'],
                ['Choose a stylist', 'Or “anyone” for the widest choice of times.'],
                ['Pick a time', 'Only times that really fit are shown.'],
                ['Get reminders', 'By email and WhatsApp, the day before and two hours before.'],
              ].map(([title, text], i) => (
                <li key={title}>
                  <span className="font-display text-4xl italic text-brass">{i + 1}</span>
                  <p className="mt-3 text-lg text-emerald">{title}</p>
                  <p className="mt-1 leading-relaxed text-ink/65">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Visit ── */}
        <section id="visit" aria-labelledby="visit-title" className={`${wrap} grid gap-12 py-20 md:grid-cols-2 md:py-28`}>
          <div>
            <h2 id="visit-title" className="font-display text-[clamp(2.4rem,5vw,4rem)] font-[350] leading-none text-emerald">Visit us</h2>
            <p className="mt-5 text-lg text-ink/75">{salon.area}</p>
            <p className="mt-1 text-ink/60">{salon.phoneDisplay}</p>
            <p className="text-ink/60">{salon.email}</p>
            <Link href="/book" className="btn btn-emerald mt-8">Book a visit</Link>
          </div>
          <dl className="divide-y divide-linen border-y border-linen">
            {hoursRows().map((r) => (
              <div key={r.days} className="flex justify-between gap-6 py-4">
                <dt className="text-ink/75">{r.days}</dt>
                <dd className={r.text === 'Closed' ? 'text-ink/45' : 'text-emerald'}>{r.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="bg-emerald py-12 text-bone/70">
        <div className={`${wrap} flex flex-col gap-6 md:flex-row md:items-center md:justify-between`}>
          <span className="text-2xl text-bone"><Wordmark /></span>
          <p className="max-w-[60ch] text-sm leading-relaxed">
            Maison Adé is a made-up salon for a portfolio project. Names, prices and contact details are examples.
          </p>
        </div>
        <div className={`${wrap} mt-8 flex items-center gap-2 text-brass-light/70`}>
          <Crown className="w-5" /><span className="text-xs">© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </>
  );
}
