import Link from 'next/link';
import { addDays } from '@/lib/availability.js';
import { clock, dayParts, longDate, shortDate } from '@/lib/format.js';

// The week strip + free times. Used by booking (/book) and by "change time" (/b/.../change).
// It only draws links; `link(changes)` builds each address, so each page keeps its own address format.

/**
 * @param {object} p
 * @param {string}   p.week        first day shown
 * @param {string[]} p.weekDays    the days shown (up to 7)
 * @param {string}   p.today       first bookable day
 * @param {string}   p.lastDay     last bookable day
 * @param {string?}  p.date        chosen day, if any
 * @param {Map}      p.slotsByDay  day → free slots
 * @param {(changes: object) => string} p.link  address for { week?, date?, time? } changes
 * @param {string?}  p.notice      a message to show above the week (e.g. "that time was just taken")
 * @param {string}   p.emptyWeekHint  what to suggest when a whole week is full
 */
export default function SlotPicker({ week, weekDays, today, lastDay, date, slotsByDay, link, notice, emptyWeekHint }) {
  const daySlots = date ? slotsByDay.get(date) ?? [] : [];
  const earlier = week > today ? (addDays(week, -7) > today ? addDays(week, -7) : today) : null;
  const later = addDays(week, 7) <= lastDay ? addDays(week, 7) : null;

  return (
    <section className="mt-10" aria-label="Day and time">
      {notice && <p role="alert" className="mb-6 rounded-[14px] bg-brass-light/40 px-5 py-4 text-emerald">{notice}</p>}

      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-emerald">
          {weekDays.length > 1 ? `${shortDate(weekDays[0])} – ${shortDate(weekDays.at(-1))}` : shortDate(weekDays[0])}
        </h2>
        <div className="flex gap-2">
          <WeekArrow to={earlier && link({ week: earlier, date: null, time: null })} label="Earlier week" dir="‹" />
          <WeekArrow to={later && link({ week: later, date: null, time: null })} label="Later week" dir="›" />
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekDays.map((d) => {
          const p = dayParts(d);
          const count = (slotsByDay.get(d) ?? []).length;
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
              {count > 0 ? (
                <Link href={link({ date: d, time: null })} aria-current={selected ? 'date' : undefined}
                  aria-label={`${longDate(d)}, ${count} times free`}
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
          {weekDays.some((d) => (slotsByDay.get(d) ?? []).length) ? 'Choose a day to see the free times.' : `Nothing is free this week. ${emptyWeekHint}`}
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
                      <Link href={link({ time: s.time })}
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
  );
}

function WeekArrow({ to, label, dir }) {
  const base = 'flex size-11 items-center justify-center rounded-full border text-xl';
  return to
    ? <Link href={to} aria-label={label} className={`${base} border-linen text-emerald hover:border-emerald/40`}>{dir}</Link>
    : <span aria-hidden="true" className={`${base} border-transparent text-ink/20`}>{dir}</span>;
}
