import 'server-only';
import { db } from './supabase.js';
import { deliver, MAX_ATTEMPTS, queueMessages } from './messages/outbox.js';
import { remindersDue, retryDue } from './reminder-rules.js';

// What the 15-minute clock runs (via /api/cron/reminders):
//   1. queue and send reminders that are due
//   2. retry messages that failed for a temporary reason
//   3. tidy up messages that got stuck half-way (e.g. the server stopped mid-send)
// Every step is safe to run twice: the message log's rules mean nothing is ever sent twice.

const MINUTE = 60_000;
const BATCH = 100; // at most this many of each per run, so a run never takes too long

/**
 * @param {object} [options]
 * @param {Date}   [options.now]      tests pass a fixed time
 * @param {object} [options.senders]  tests pass fake senders
 * @returns {Promise<object>} a summary of what happened, for the logs
 */
export async function runReminders({ now = new Date(), senders } = {}) {
  const supabase = db();
  const summary = { remindersQueued: 0, sent: 0, failed: 0, skipped: 0, retried: 0, stuck: 0 };
  const count = (result) => { if (summary[result] !== undefined) summary[result] += 1; };

  // 1. Reminders: confirmed bookings starting within the next 24 hours
  const { data: bookings, error } = await supabase.from('bookings')
    .select('id, status, starts_at, created_at')
    .eq('status', 'confirmed')
    .gt('starts_at', now.toISOString())
    .lte('starts_at', new Date(now.getTime() + 24 * 60 * MINUTE).toISOString())
    .order('starts_at').limit(BATCH * 2);
  if (error) throw error;

  for (const booking of bookings) {
    for (const kind of remindersDue(booking, now)) {
      const ids = await queueMessages(booking.id, kind); // already-queued ones come back empty: never twice
      summary.remindersQueued += ids.length;
      for (const id of ids) count(await deliver(id, senders, now));
    }
  }

  // 2. Stuck "sending" for over 10 minutes: the send was interrupted, so we don't know if it went.
  //    Email can be retried safely (Resend ignores repeats of the same message id). WhatsApp can't, so it's
  //    marked failed for staff to check, because a duplicate is worse than a missing message.
  const { data: stuck, error: stuckError } = await supabase.from('messages')
    .select('id, channel').eq('status', 'sending')
    .lt('last_tried_at', new Date(now.getTime() - 10 * MINUTE).toISOString()).limit(BATCH);
  if (stuckError) throw stuckError;
  for (const m of stuck) {
    const update = m.channel === 'email'
      ? { status: 'failed', error: 'Interrupted while sending; retrying (safe for email).' }
      : { status: 'failed', attempts: MAX_ATTEMPTS, error: 'Interrupted while sending, so it may or may not have arrived. Not retried, to avoid sending twice.' };
    const { error: e } = await supabase.from('messages').update(update).eq('id', m.id).eq('status', 'sending');
    if (e) throw e;
    summary.stuck += 1;
  }

  // 3. Retries: failed (temporary) messages once their wait is over, and "pending" ones older than 2 minutes
  //    (their first send never ran, e.g. the server stopped right after the booking)
  const { data: waiting, error: waitingError } = await supabase.from('messages')
    .select('id, status, attempts, last_tried_at, created_at')
    .or(`status.eq.failed,and(status.eq.pending,created_at.lt.${new Date(now.getTime() - 2 * MINUTE).toISOString()})`)
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at').limit(BATCH);
  if (waitingError) throw waitingError;
  for (const m of waiting) {
    if (m.status === 'failed' && !retryDue(m, MAX_ATTEMPTS, now)) continue;
    summary.retried += 1;
    count(await deliver(m.id, senders, now));
  }

  // 4. Privacy: booking fingerprints are only needed for the 1-hour limit, so forget them after 2 days
  const { error: tidyError } = await supabase.from('bookings').update({ ip_hash: null })
    .not('ip_hash', 'is', null).lt('created_at', new Date(now.getTime() - 48 * 60 * MINUTE).toISOString());
  if (tidyError) throw tidyError;

  return summary;
}
