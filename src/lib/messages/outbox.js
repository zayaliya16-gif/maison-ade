import 'server-only';
import { db } from '../supabase.js';
import { hashToken, linkTokenFor } from '../booking.js';
import { composeMessage, WHATSAPP_TEMPLATES } from './templates.js';
import { sendEmail, sendWhatsApp } from './providers.js';

// The outbox: every message is first written to the `messages` table, then sent, then marked with what happened.
//
// Never twice:
//  1. The database allows only one message per booking + channel + kind + appointment time.
//  2. Before sending, a message is "claimed" (pending/failed → sending) in a way only one worker can win.
//  3. Email uses the message id as Resend's idempotency key, so even a repeat request is ignored by Resend.

export const MAX_ATTEMPTS = 5;

/** The site's public address, for links in messages */
export function siteUrl() {
  const fromVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return (process.env.SITE_URL || fromVercel || 'http://localhost:3000').replace(/\/+$/, '');
}

const BOOKING_FIELDS = 'id, customer_name, customer_phone, customer_email, whatsapp_opt_in, email_opt_in, starts_at, price_kobo, manage_token_hash, service:services(name, minutes), stylist:staff(name)';

/**
 * Writes the messages a booking event needs (one per channel the customer agreed to).
 * Already-written ones are left alone, so calling this twice is harmless.
 * @returns {Promise<string[]>} ids of messages that are new
 */
export async function queueMessages(bookingId, kind) {
  const supabase = db();
  const { data: booking, error } = await supabase.from('bookings').select(BOOKING_FIELDS).eq('id', bookingId).maybeSingle();
  if (error) throw error;
  if (!booking) return [];

  const rows = [];
  if (booking.email_opt_in && booking.customer_email) rows.push({ channel: 'email', recipient: booking.customer_email });
  if (booking.whatsapp_opt_in) rows.push({ channel: 'whatsapp', recipient: booking.customer_phone });
  if (rows.length === 0) return [];

  const { data, error: insertError } = await supabase.from('messages')
    .upsert(rows.map((r) => ({ ...r, booking_id: booking.id, kind, for_starts_at: booking.starts_at })),
      { onConflict: 'booking_id,channel,kind,for_starts_at', ignoreDuplicates: true })
    .select('id');
  if (insertError) throw insertError;
  return data.map((row) => row.id);
}

/**
 * Sends one message if it's waiting (pending, or failed and worth retrying).
 * @param {string} messageId
 * @param {object} [senders]  { email, whatsapp } — tests pass fake senders; normally the real ones
 * @returns {Promise<string>} what happened: sent | failed | skipped | busy (someone else is sending it) | done (nothing to do)
 */
export async function deliver(messageId, senders = { email: sendEmail, whatsapp: sendWhatsApp }) {
  const supabase = db();
  const { data: msg, error } = await supabase.from('messages')
    .select(`id, channel, kind, recipient, status, attempts, for_starts_at, booking:bookings(${BOOKING_FIELDS})`)
    .eq('id', messageId).maybeSingle();
  if (error) throw error;
  if (!msg || !['pending', 'failed'].includes(msg.status) || msg.attempts >= MAX_ATTEMPTS) return 'done';

  // Claim it: only succeeds if nobody else changed it since we read it
  const { data: claimed, error: claimError } = await supabase.from('messages')
    .update({ status: 'sending', attempts: msg.attempts + 1, last_tried_at: new Date().toISOString() })
    .eq('id', msg.id).eq('attempts', msg.attempts).in('status', ['pending', 'failed'])
    .select('id');
  if (claimError) throw claimError;
  if (claimed.length === 0) return 'busy';

  let result;
  try {
    // The message is about the time it was created for (if the booking moves, a new "moved" message covers the new time)
    const booking = { ...msg.booking, starts_at: msg.for_starts_at };
    const token = linkTokenFor(booking.id);
    const link = hashToken(token) === booking.manage_token_hash ? `${siteUrl()}/b/${token}` : null; // older bookings had random links
    const content = composeMessage(msg.kind, booking, { link, bookLink: `${siteUrl()}/book` });
    result = msg.channel === 'email'
      ? await senders.email({ to: msg.recipient, subject: content.subject, text: content.text, html: content.html, messageId: msg.id })
      : await senders.whatsapp({ to: msg.recipient, text: content.whatsappText, template: WHATSAPP_TEMPLATES[msg.kind], values: content.values });
  } catch (sendError) {
    result = { ok: false, retry: true, error: `Unexpected error: ${sendError.message}`.slice(0, 500) };
  }

  const update = result.ok
    ? { status: 'sent', provider_id: result.id, sent_at: new Date().toISOString(), error: null }
    : result.skipped
      ? { status: 'skipped', error: result.error }
      // Not worth retrying (e.g. a wrong number): use up the attempts so it isn't tried again
      : { status: 'failed', error: result.error, ...(result.retry ? {} : { attempts: MAX_ATTEMPTS }) };
  const { error: saveError } = await supabase.from('messages').update(update).eq('id', msg.id);
  if (saveError) throw saveError;
  return update.status;
}

/**
 * Queue and send everything for a booking event. Never throws: messages must never break booking.
 * Call it inside `after(...)` so the customer's page doesn't wait for email or WhatsApp.
 */
export async function notify(bookingId, kind) {
  try {
    const ids = await queueMessages(bookingId, kind);
    for (const id of ids) await deliver(id);
  } catch (error) {
    console.error(`Messages for booking ${bookingId} (${kind}) failed`, error);
  }
}

/** Staff "retry" button: lets a failed or skipped message be tried once more */
export async function retryMessage(messageId) {
  const supabase = db();
  const { data, error } = await supabase.from('messages')
    .update({ status: 'failed', attempts: MAX_ATTEMPTS - 1 })
    .eq('id', messageId).in('status', ['failed', 'skipped'])
    .select('id');
  if (error) throw error;
  if (data.length === 0) return 'done';
  return deliver(messageId);
}

/** The most recent messages, for the staff log */
export async function recentMessages(limit = 100) {
  const { data, error } = await db().from('messages')
    .select('id, channel, kind, recipient, status, attempts, error, created_at, sent_at, for_starts_at, booking:bookings(customer_name, service:services(name), stylist:staff(name))')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}
