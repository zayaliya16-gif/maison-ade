import Link from 'next/link';
import Wordmark from '@/components/Wordmark.jsx';
import { requireStaff } from '@/lib/staff-auth.js';
import { recentMessages } from '@/lib/messages/outbox.js';
import { toLagos } from '@/lib/availability.js';
import { clock, shortDate } from '@/lib/format.js';
import { logoutAction, retryMessageAction } from '../actions.js';

// The message log: every email and WhatsApp, and what happened to it. Staff only.

export const metadata = { title: 'Messages | Maison Adé staff', robots: { index: false, follow: false } };

const KIND = { confirmed: 'Booked', moved: 'Moved', cancelled: 'Cancelled', reminder_day: 'Reminder (day before)', reminder_soon: 'Reminder (2 hours)' };
const STATUS = {
  sent: ['Sent', 'bg-emerald text-bone'],
  pending: ['Waiting', 'bg-linen text-ink'],
  sending: ['Sending', 'bg-linen text-ink'],
  failed: ['Failed', 'bg-red-800 text-white'],
  skipped: ['Not sent', 'bg-brass-light text-emerald'],
};

const at = (iso) => { const t = toLagos(iso); return `${shortDate(t.date)}, ${clock(t.time)}`; };

export default async function MessagesPage() {
  await requireStaff();
  const messages = await recentMessages(100);

  return (
    <>
      <header className="border-b border-linen">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="text-2xl text-emerald"><Wordmark /></Link>
            <span className="text-sm text-brass">Staff</span>
          </div>
          <nav aria-label="Staff" className="flex items-center gap-5 text-sm">
            <Link href="/staff" className="text-ink/65 hover:text-ink">Diary</Link>
            <span aria-current="page" className="text-emerald">Messages</span>
            <form action={logoutAction}><button type="submit" className="text-ink/65 hover:text-ink">Log out</button></form>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1240px] px-5 pb-24 pt-8 sm:px-8">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] font-[350] leading-tight text-emerald">Messages</h1>
        <p className="mt-1 text-sm text-ink/60">The latest 100 emails and WhatsApps, newest first. Times are Lagos time.</p>

        {messages.length === 0 && <p className="mt-10 text-ink/60">No messages yet. They appear here when customers book, move or cancel.</p>}

        <ul className="mt-8 divide-y divide-linen rounded-[14px] border border-linen bg-white/40">
          {messages.map((m) => {
            const [label, tone] = STATUS[m.status] ?? [m.status, 'bg-linen'];
            return (
              <li key={m.id} className="grid gap-2 px-5 py-4 md:grid-cols-[9rem_1fr_auto] md:items-start md:gap-6">
                <div>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs ${tone}`}>{label}</span>
                  <p className="mt-1 text-xs text-ink/50">{at(m.created_at)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-emerald">
                    {m.channel === 'email' ? 'Email' : 'WhatsApp'} · {KIND[m.kind] ?? m.kind} · {m.booking?.customer_name}
                  </p>
                  <p className="text-sm text-ink/60">
                    {m.booking?.service?.name} with {m.booking?.stylist?.name}, {at(m.for_starts_at)} · to <span className="break-all">{m.recipient}</span>
                  </p>
                  {m.error && <p className="mt-1 text-sm text-red-800">{m.error}</p>}
                  {m.attempts > 1 && <p className="mt-1 text-xs text-ink/50">{m.attempts} tries</p>}
                </div>
                {['failed', 'skipped'].includes(m.status) && (
                  <form action={retryMessageAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className="btn btn-line min-h-10! px-4! text-sm text-emerald">Try again</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
