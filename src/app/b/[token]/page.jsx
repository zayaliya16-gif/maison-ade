import Link from 'next/link';
import { notFound } from 'next/navigation';
import Wordmark, { Crown } from '@/components/Wordmark.jsx';
import { getBookingByToken } from '@/lib/booking.js';
import { toLagos } from '@/lib/availability.js';
import { clock, duration, longDate, naira } from '@/lib/format.js';
import { salon } from '@/config/salon.js';

// The customer's private booking page. Only someone with the link can see it.
// Phase 4 adds "change" and "cancel" here.

export const metadata = {
  title: 'Your booking | Maison Adé',
  robots: { index: false, follow: false }, // keep private links out of search engines
  referrer: 'no-referrer', // never pass this address on to other sites
};

export default async function BookingPage({ params }) {
  const { token } = await params;
  const booking = await getBookingByToken(token);
  if (!booking) notFound();

  const start = toLagos(booking.starts_at);
  const cancelled = booking.status === 'cancelled';
  const reminders = [booking.whatsapp_opt_in && 'WhatsApp', booking.email_opt_in && 'email'].filter(Boolean);

  return (
    <main id="main" className="mx-auto max-w-[40rem] px-5 pb-24 pt-10">
      <Link href="/" className="text-2xl text-emerald"><Wordmark /></Link>

      <div className="mt-14 flex items-center gap-3 text-brass"><Crown className="w-7" /><span className="text-sm">{cancelled ? 'Cancelled' : 'Booked'}</span></div>
      <h1 className="mt-3 font-display text-[clamp(2.2rem,6vw,3.4rem)] font-[350] leading-none text-emerald">
        {cancelled ? 'This booking was cancelled' : `See you soon, ${booking.customer_name.split(' ')[0]}`}
      </h1>

      <dl className="mt-10 divide-y divide-linen rounded-[14px] border border-linen bg-white/40">
        <Row label="When" value={`${longDate(start.date)}, ${clock(start.time)}`} />
        <Row label="Service" value={`${booking.service.name} · ${duration(booking.service.minutes)}`} />
        <Row label="Stylist" value={booking.stylist.name} />
        <Row label="Price" value={`${naira(booking.price_kobo)}, paid at the salon`} />
        <Row label="Where" value={`${salon.name}, ${salon.area}`} />
      </dl>

      {!cancelled && (
        <>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={`/b/${token}/calendar`} className="btn btn-emerald">Add to calendar</a>
            <Link href="/" className="btn btn-line text-emerald">Back to the salon</Link>
          </div>
          <div className="mt-10 space-y-3 leading-relaxed text-ink/70">
            <p>
              {reminders.length
                ? `We’ll remind you by ${reminders.join(' and ')} the day before and two hours before.`
                : 'You chose no reminders, so please make a note of the time.'}
            </p>
            <p>
              <strong className="font-medium text-emerald">Keep this page’s link.</strong> It’s private to you: it’s how you’ll change or cancel this booking.
              To change it now, call us on {salon.phoneDisplay}.
            </p>
          </div>
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
