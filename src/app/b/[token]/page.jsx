import Link from 'next/link';
import { notFound } from 'next/navigation';
import Wordmark, { Crown } from '@/components/Wordmark.jsx';
import ConfirmButton from '@/components/ConfirmButton.jsx';
import { canChangeOnline, getBookingByToken } from '@/lib/booking.js';
import { toLagos } from '@/lib/availability.js';
import { clock, duration, longDate, naira } from '@/lib/format.js';
import { bookingRules, salon } from '@/config/salon.js';
import { cancelAction } from './actions.js';

// The customer's private booking page. Only someone with the link can see it.

export const metadata = {
  title: 'Your booking | Maison Adé',
  robots: { index: false, follow: false }, // keep private links out of search engines
  referrer: 'no-referrer', // never pass this address on to other sites
};

// Messages after an action. Only these fixed texts can ever appear (the address can't inject words).
const NOTES = {
  moved: 'Done: your booking has moved to the new time.',
  cancelled: 'Your booking is cancelled. We hope to see you another time.',
  'too-late': `It’s now less than ${bookingRules.changeCutoffMinutes / 60} hours until your appointment, so please call us on ${salon.phoneDisplay} to change it.`,
  'already-cancelled': 'This booking was already cancelled.',
  error: `Something went wrong and nothing was changed. Please try again, or call us on ${salon.phoneDisplay}.`,
};

export default async function BookingPage({ params, searchParams }) {
  const { token } = await params;
  const { note } = await searchParams;
  const booking = await getBookingByToken(token);
  if (!booking) notFound();

  const start = toLagos(booking.starts_at);
  const cancelled = booking.status === 'cancelled';
  const changeable = canChangeOnline(booking);
  const reminders = [booking.whatsapp_opt_in && 'WhatsApp', booking.email_opt_in && 'email'].filter(Boolean);
  const message = NOTES[note];

  return (
    <main id="main" className="mx-auto max-w-[40rem] px-5 pb-24 pt-10">
      <Link href="/" className="text-2xl text-emerald"><Wordmark /></Link>

      {message && <p role="status" className="mt-10 rounded-[14px] bg-brass-light/40 px-5 py-4 text-emerald">{message}</p>}

      <div className="mt-12 flex items-center gap-3 text-brass"><Crown className="w-7" /><span className="text-sm">{cancelled ? 'Cancelled' : 'Booked'}</span></div>
      <h1 className="mt-3 font-display text-[clamp(2.2rem,6vw,3.4rem)] font-[350] leading-none text-emerald">
        {cancelled ? 'This booking is cancelled' : `See you soon, ${booking.customer_name.split(' ')[0]}`}
      </h1>

      <dl className={`mt-10 divide-y divide-linen rounded-[14px] border border-linen bg-white/40 ${cancelled ? 'opacity-60' : ''}`}>
        <Row label="When" value={`${longDate(start.date)}, ${clock(start.time)}`} />
        <Row label="Service" value={`${booking.service.name} · ${duration(booking.service.minutes)}`} />
        <Row label="Stylist" value={booking.stylist.name} />
        <Row label="Price" value={`${naira(booking.price_kobo)}, paid at the salon`} />
        <Row label="Where" value={`${salon.name}, ${salon.area}`} />
      </dl>

      {cancelled && (
        <Link href="/book" className="btn btn-emerald mt-8">Book another visit</Link>
      )}

      {!cancelled && (
        <>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={`/b/${token}/calendar`} className="btn btn-emerald">Add to calendar</a>
          </div>

          <p className="mt-10 leading-relaxed text-ink/70">
            {reminders.length
              ? `We’ll remind you by ${reminders.join(' and ')} the day before and two hours before.`
              : 'You chose no reminders, so please make a note of the time.'}
          </p>

          <section aria-labelledby="change-title" className="mt-12 border-t border-linen pt-8">
            <h2 id="change-title" className="font-display text-2xl text-emerald">Need to change something?</h2>
            {changeable ? (
              <>
                <p className="mt-2 leading-relaxed text-ink/70">
                  You can move or cancel online until {bookingRules.changeCutoffMinutes / 60} hours before. Keep this page’s link: it’s private to you.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href={`/b/${token}/change`} className="btn btn-line text-emerald">Change time</Link>
                  <form action={cancelAction}>
                    <input type="hidden" name="token" value={token} />
                    <ConfirmButton question="Cancel this booking? The time will be offered to other customers." pendingText="Cancelling…">
                      Cancel booking
                    </ConfirmButton>
                  </form>
                </div>
              </>
            ) : (
              <p className="mt-2 leading-relaxed text-ink/70">
                It’s less than {bookingRules.changeCutoffMinutes / 60} hours until your appointment, so please call us on {salon.phoneDisplay}.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Row({ label, value }) {
  return (
    <div className="px-5 py-3.5">
      <dt className="text-xs uppercase tracking-wide text-ink/50">{label}</dt>
      <dd className="mt-0.5 text-emerald">{value}</dd>
    </div>
  );
}
