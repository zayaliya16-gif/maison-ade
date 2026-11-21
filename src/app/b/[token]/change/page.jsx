import Link from 'next/link';
import { notFound } from 'next/navigation';
import Wordmark from '@/components/Wordmark.jsx';
import SlotPicker from '@/components/SlotPicker.jsx';
import { canChangeOnline, getBookingByToken } from '@/lib/booking.js';
import { toLagos } from '@/lib/availability.js';
import { readPickerParams } from '@/lib/picker-params.js';
import { findSlotsForDays } from '@/lib/schedule.js';
import { clock, longDate } from '@/lib/format.js';
import { moveAction } from '../actions.js';

// Move a booking to another time: same service, same stylist.

export const metadata = {
  title: 'Change your booking | Maison Adé',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function ChangePage({ params, searchParams }) {
  const { token } = await params;
  const q = await searchParams;
  const booking = await getBookingByToken(token);
  if (!booking) notFound();

  const back = `/b/${token}`;
  const current = toLagos(booking.starts_at);

  if (!canChangeOnline(booking)) {
    return (
      <Shell back={back}>
        <h1 className="mt-12 font-display text-[clamp(2rem,5vw,3rem)] font-[350] leading-none text-emerald">This booking can’t be changed online</h1>
        <p className="mt-5 text-lg text-ink/70">It may be cancelled, or too close to the appointment. Please see your booking page for details.</p>
        <Link href={back} className="btn btn-emerald mt-8">Back to your booking</Link>
      </Shell>
    );
  }

  const picker = readPickerParams(q);
  // Their own current time doesn't block the new one (so moving 30 minutes later works)
  const slotsByDay = await findSlotsForDays({ serviceId: booking.service_id, staffId: booking.staff_id, dates: picker.weekDays, ignoreBookingId: booking.id });
  // Don't offer the time they already have
  if (slotsByDay.has(current.date)) slotsByDay.set(current.date, slotsByDay.get(current.date).filter((s) => s.time !== current.time));
  const slot = picker.date ? (slotsByDay.get(picker.date) ?? []).find((s) => s.time === picker.time) : null;
  const sameAsNow = slot && picker.date === current.date && slot.time === current.time;

  const link = (changes) => {
    const all = { week: picker.week, date: picker.date, time: slot?.time, ...changes };
    const p = new URLSearchParams();
    for (const key of ['week', 'date', 'time']) if (all[key]) p.set(key, all[key]);
    return `/b/${token}/change?${p}`;
  };
  const notice = q.note === 'taken' ? 'Sorry, that time was just taken. Please pick another.'
    : picker.date && picker.time && !slot ? `Sorry, ${clock(picker.time)} is no longer free. Please pick another time.` : null;

  return (
    <Shell back={back}>
      <h1 className="mt-12 font-display text-[clamp(2.2rem,6vw,3.4rem)] font-[350] leading-none text-emerald">Choose a new time</h1>
      <p className="mt-4 text-lg text-ink/70">
        {booking.service.name} with {booking.stylist.name}. Now: {longDate(current.date)}, {clock(current.time)}.
      </p>

      {slot && !sameAsNow ? (
        <form action={moveAction} className="mt-10 rounded-[14px] border border-linen bg-white/40 p-6">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="date" value={picker.date} />
          <input type="hidden" name="time" value={slot.time} />
          <p className="text-sm text-ink/60">Move to</p>
          <p className="mt-1 font-display text-2xl text-emerald">{longDate(picker.date)}, {clock(slot.time)}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="submit" className="btn btn-emerald">Confirm new time</button>
            <Link href={link({ time: null })} className="btn btn-line text-emerald">Pick another</Link>
          </div>
        </form>
      ) : (
        <SlotPicker {...picker} slotsByDay={slotsByDay} link={link} notice={notice}
          emptyWeekHint={`Try the next week, or book with a different stylist.`} />
      )}
    </Shell>
  );
}

function Shell({ back, children }) {
  return (
    <main id="main" className="mx-auto max-w-[46rem] px-5 pb-24 pt-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-2xl text-emerald"><Wordmark /></Link>
        <Link href={back} className="text-sm text-ink/65 hover:text-ink">Back to your booking</Link>
      </div>
      {children}
    </main>
  );
}
