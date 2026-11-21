import Link from 'next/link';
import Wordmark from '@/components/Wordmark.jsx';
import ConfirmButton from '@/components/ConfirmButton.jsx';
import { requireStaff } from '@/lib/staff-auth.js';
import { getStaffDay } from '@/lib/staff.js';
import { addDays, lagosToday, parseDate, toLagos } from '@/lib/availability.js';
import { clock, longDate, naira, shortDate } from '@/lib/format.js';
import { staff as salonStaff } from '@/config/salon.js';
import { addTimeOffAction, logoutAction, removeTimeOffAction, staffCancelAction } from './actions.js';

// The salon diary: one day, one column per stylist. Staff only.

export const metadata = { title: 'Diary | Maison Adé staff', robots: { index: false, follow: false } };

const NOTES = {
  'timeoff-added': 'Time off added. Those hours are no longer offered online.',
  'timeoff-removed': 'Time off removed. Those hours are offered online again.',
  'timeoff-invalid': 'That time off wasn’t saved: please check the stylist, dates and times (the end must be after the start).',
  'booking-cancelled': 'Booking cancelled. The time is offered online again.',
  error: 'Something went wrong and nothing was changed. Please try again.',
};
function noteText(note) {
  const clash = /^timeoff-clash-(\d{1,2})$/.exec(String(note ?? ''));
  if (clash) {
    const n = Number(clash[1]);
    return `Time off added, but ${n} booking${n === 1 ? ' is' : 's are'} already in that time. They have NOT been cancelled: please contact ${n === 1 ? 'that customer' : 'those customers'} and cancel or move ${n === 1 ? 'it' : 'them'}.`;
  }
  return NOTES[note] ?? null;
}

/** "09:00" → "9:00 am", but across days: "Tue 3 Dec, 9:00 am" */
function when(iso, date) {
  const t = toLagos(iso);
  return t.date === date ? clock(t.time) : `${shortDate(t.date)}, ${clock(t.time)}`;
}

export default async function StaffDiary({ searchParams }) {
  await requireStaff();
  const q = await searchParams;
  let date = String(q.date ?? '');
  try { parseDate(date); } catch { date = lagosToday(); }

  const day = await getStaffDay(date);
  const message = noteText(q.note);
  // Salon order from salon.js, names from the database
  const order = salonStaff.map((p) => p.id);
  const people = [...day.staff].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const confirmedCount = day.bookings.filter((b) => b.status === 'confirmed').length;

  return (
    <>
      <header className="border-b border-linen">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="text-2xl text-emerald"><Wordmark /></Link>
            <span className="text-sm text-brass">Staff</span>
          </div>
          <form action={logoutAction}><button type="submit" className="text-sm text-ink/65 hover:text-ink">Log out</button></form>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1240px] px-5 pb-24 pt-8 sm:px-8">
        {/* Day navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] font-[350] leading-tight text-emerald">{longDate(date)}</h1>
            <p className="text-sm text-ink/60">{confirmedCount} booking{confirmedCount === 1 ? '' : 's'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/staff?date=${addDays(date, -1)}`} aria-label="Previous day" className="flex size-11 items-center justify-center rounded-full border border-linen text-xl text-emerald hover:border-emerald/40">‹</Link>
            <Link href="/staff" className="btn btn-line min-h-11! px-4! text-emerald">Today</Link>
            <Link href={`/staff?date=${addDays(date, 1)}`} aria-label="Next day" className="flex size-11 items-center justify-center rounded-full border border-linen text-xl text-emerald hover:border-emerald/40">›</Link>
            <form action="/staff" className="flex items-center gap-2">
              <label htmlFor="jump" className="sr-only">Go to date</label>
              <input id="jump" type="date" name="date" defaultValue={date} className="h-11 rounded-full border border-linen bg-white/70 px-4 text-sm" />
              <button type="submit" className="btn btn-emerald min-h-11! px-4!">Go</button>
            </form>
          </div>
        </div>

        {message && <p role="status" className="mt-6 rounded-[14px] bg-brass-light/40 px-5 py-4 text-emerald">{message}</p>}

        {/* One column per stylist */}
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {people.map((person) => {
            const hours = day.hours.find((h) => h.staff_id === person.id);
            const items = [
              ...day.bookings.filter((b) => b.staff_id === person.id).map((b) => ({ kind: 'booking', at: b.starts_at, b })),
              ...day.timeOff.filter((t) => t.staff_id === person.id).map((t) => ({ kind: 'off', at: t.starts_at, t })),
            ].sort((x, y) => x.at.localeCompare(y.at));

            return (
              <section key={person.id} aria-labelledby={`p-${person.id}`} className="rounded-[14px] border border-linen bg-white/40">
                <div className="border-b border-linen px-4 py-3">
                  <h2 id={`p-${person.id}`} className="font-display text-xl text-emerald">{person.name}</h2>
                  <p className="text-sm text-ink/55">{hours ? `${clock(hours.starts.slice(0, 5))} – ${clock(hours.ends.slice(0, 5))}` : 'Day off'}</p>
                </div>
                {items.length === 0 && <p className="px-4 py-5 text-sm text-ink/45">Nothing booked.</p>}
                <ul className="divide-y divide-linen">
                  {items.map((item) => item.kind === 'booking'
                    ? <BookingItem key={item.b.id} b={item.b} date={date} />
                    : <TimeOffItem key={item.t.id} t={item.t} date={date} />)}
                </ul>
              </section>
            );
          })}
        </div>

        {/* Add time off */}
        <section aria-labelledby="off-title" className="mt-14 max-w-[46rem] rounded-[14px] border border-linen bg-white/40 p-5 sm:p-6">
          <h2 id="off-title" className="font-display text-2xl text-emerald">Add time off</h2>
          <p className="mt-1 text-sm text-ink/60">Holidays, sick days or blocked hours. Leave the times blank for whole days.</p>
          <form action={addTimeOffAction} className="mt-5 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="returnDate" value={date} />
            <label className="text-sm text-ink/70 sm:col-span-2">Stylist
              <select name="staffId" required className="mt-1.5 block h-11 w-full rounded-[10px] border border-linen bg-white/80 px-3 text-[1rem] text-ink">
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-ink/70">From date
              <input type="date" name="startDate" required defaultValue={date} className="mt-1.5 block h-11 w-full rounded-[10px] border border-linen bg-white/80 px-3 text-[1rem] text-ink" />
            </label>
            <label className="text-sm text-ink/70">From time (optional)
              <input type="time" name="startTime" step="900" className="mt-1.5 block h-11 w-full rounded-[10px] border border-linen bg-white/80 px-3 text-[1rem] text-ink" />
            </label>
            <label className="text-sm text-ink/70">To date
              <input type="date" name="endDate" required defaultValue={date} className="mt-1.5 block h-11 w-full rounded-[10px] border border-linen bg-white/80 px-3 text-[1rem] text-ink" />
            </label>
            <label className="text-sm text-ink/70">To time (optional)
              <input type="time" name="endTime" step="900" className="mt-1.5 block h-11 w-full rounded-[10px] border border-linen bg-white/80 px-3 text-[1rem] text-ink" />
            </label>
            <label className="text-sm text-ink/70 sm:col-span-2">Reason (optional, staff only)
              <input type="text" name="reason" maxLength={200} className="mt-1.5 block h-11 w-full rounded-[10px] border border-linen bg-white/80 px-3 text-[1rem] text-ink" />
            </label>
            <div className="sm:col-span-2"><button type="submit" className="btn btn-emerald">Add time off</button></div>
          </form>
        </section>
      </main>
    </>
  );
}

function BookingItem({ b, date }) {
  const cancelled = b.status === 'cancelled';
  const digits = b.customer_phone.replace(/\D/g, '');
  return (
    <li className={`px-4 py-4 ${cancelled ? 'opacity-50' : ''}`}>
      <p className={`text-sm text-brass ${cancelled ? 'line-through' : ''}`}>{when(b.starts_at, date)} – {when(b.ends_at, date)}</p>
      <p className={`mt-0.5 text-emerald ${cancelled ? 'line-through' : ''}`}>{b.service?.name}</p>
      <p className="mt-1 text-sm text-ink">{b.customer_name}</p>
      <p className="text-sm">
        <a href={`tel:${b.customer_phone}`} className="text-ink/70 underline-offset-4 hover:underline">{b.customer_phone}</a>
        {' · '}
        <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="text-ink/70 underline-offset-4 hover:underline">WhatsApp</a>
      </p>
      {b.customer_email && <p className="break-all text-sm text-ink/60">{b.customer_email}</p>}
      <p className="mt-1 text-xs text-ink/50">
        {naira(b.price_kobo)}
        {b.moved_at && ' · moved by customer'}
        {cancelled && ` · cancelled by ${b.cancelled_by ?? 'unknown'}`}
      </p>
      {!cancelled && (
        <form action={staffCancelAction} className="mt-2">
          <input type="hidden" name="id" value={b.id} />
          <input type="hidden" name="returnDate" value={date} />
          <ConfirmButton question={`Cancel ${b.customer_name}'s booking? Tell them first: they are not messaged automatically yet.`}
            className="text-sm text-red-800 underline-offset-4 hover:underline" pendingText="Cancelling…">Cancel booking</ConfirmButton>
        </form>
      )}
    </li>
  );
}

function TimeOffItem({ t, date }) {
  const start = toLagos(t.starts_at);
  const end = toLagos(t.ends_at);
  // Exactly midnight to midnight of this day reads better as "all day"
  const allDay = start.date === date && start.time === '00:00' && end.date === addDays(date, 1) && end.time === '00:00';
  return (
    <li className="bg-linen/50 px-4 py-4">
      <p className="text-sm text-ink/70">Time off · {allDay ? 'all day' : `${when(t.starts_at, date)} – ${when(t.ends_at, date)}`}</p>
      {t.reason && <p className="mt-0.5 text-sm text-ink/60">{t.reason}</p>}
      <form action={removeTimeOffAction} className="mt-2">
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="returnDate" value={date} />
        <ConfirmButton question="Remove this time off? Those hours will be offered online again." className="text-sm text-emerald underline-offset-4 hover:underline" pendingText="Removing…">
          Remove
        </ConfirmButton>
      </form>
    </li>
  );
}
