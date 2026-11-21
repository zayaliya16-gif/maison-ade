import 'server-only';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { db } from './supabase.js';
import { findSlots, getService } from './schedule.js';
import { lagosDayRange } from './availability.js';
import { rankStylists } from './booking-input.js';
import { bookingRules } from '../config/salon.js';

// Creating bookings and looking them up by their private link.

export const MAX_UPCOMING_PER_PHONE = 3;
const SLOT_TAKEN = '23P01'; // Postgres: the no_double_booking rule refused it

/** The private link code is shown to the customer once; the database only keeps its fingerprint (hash). */
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/**
 * The private link code for a booking. It's made from the booking's id and a server-only secret,
 * so the server can rebuild it later (for messages and reminders), while the database still only
 * stores its hash. Nobody without the secret can work it out from the id.
 * (If SUPABASE_SECRET_KEY is ever changed, existing links stop working.)
 */
export function linkTokenFor(bookingId) {
  const key = createHash('sha256').update(`maison-ade manage link
${process.env.SUPABASE_SECRET_KEY}`).digest();
  return createHmac('sha256', key).update(String(bookingId)).digest('base64url');
}
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, written in URL-safe letters

/**
 * Books an appointment. Everything is checked again here; nothing from the browser is trusted.
 * @param {object} p
 * @param {string} p.serviceId
 * @param {string} p.staffChoice  a stylist id, or "any"
 * @param {string} p.date         "YYYY-MM-DD" (Lagos)
 * @param {string} p.time         "HH:MM" (Lagos)
 * @param {object} p.customer     from parseCustomer(): { name, phone, email, whatsappOptIn, emailOptIn }
 * @returns {Promise<{ ok: true, token: string, bookingId: string } | { ok: false, reason: 'taken' | 'limit' }>}
 */
export async function createBooking({ serviceId, staffChoice, date, time, customer }) {
  const supabase = db();
  const service = await getService(serviceId);
  if (!service) return { ok: false, reason: 'taken' };

  // Is that time still free? (Also covers opening hours, days off, time off, notice and 60-day rules.)
  const slots = await findSlots({ date, serviceId, staffId: staffChoice === 'any' ? undefined : staffChoice });
  const slot = slots.find((s) => s.time === time);
  if (!slot) return { ok: false, reason: 'taken' };

  // No more than 3 upcoming bookings per phone number, to stop junk bookings filling the diary
  const { count, error: countError } = await supabase.from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('customer_phone', customer.phone).eq('status', 'confirmed').gt('starts_at', new Date().toISOString());
  if (countError) throw countError;
  if (count >= MAX_UPCOMING_PER_PHONE) return { ok: false, reason: 'limit' };

  // Who to try, in order: the chosen stylist, or for "any" whoever has the fewest bookings that day
  let candidates = slot.staffIds;
  if (staffChoice === 'any' && candidates.length > 1) {
    const { from, to } = lagosDayRange(date);
    const { data, error } = await supabase.from('bookings').select('staff_id')
      .in('staff_id', candidates).eq('status', 'confirmed').gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString());
    if (error) throw error;
    const counts = new Map();
    for (const row of data) counts.set(row.staff_id, (counts.get(row.staff_id) ?? 0) + 1);
    candidates = rankStylists(candidates, counts);
  }

  const bookingId = randomUUID();
  const token = linkTokenFor(bookingId);
  for (const staffId of candidates) {
    const { error } = await supabase.from('bookings').insert({
      id: bookingId,
      staff_id: staffId,
      service_id: service.id,
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      price_kobo: service.price_kobo,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_email: customer.email,
      whatsapp_opt_in: customer.whatsappOptIn,
      email_opt_in: customer.emailOptIn,
      manage_token_hash: hashToken(token),
    });
    if (!error) return { ok: true, token, bookingId };
    if (error.code !== SLOT_TAKEN) throw error;
    // Someone booked this stylist a moment ago: for "any", try the next free stylist
  }
  return { ok: false, reason: 'taken' };
}

/**
 * The booking behind a private link, with service and stylist names, or null.
 * Wrong, made-up or malformed links all just get null (no hint about why).
 */
export async function getBookingByToken(token) {
  if (!TOKEN_RE.test(String(token))) return null;
  const { data, error } = await db().from('bookings')
    .select('id, staff_id, service_id, starts_at, ends_at, status, cancelled_by, moved_at, customer_name, customer_phone, customer_email, whatsapp_opt_in, email_opt_in, price_kobo, service:services(id, name, minutes), stylist:staff(id, name)')
    .eq('manage_token_hash', hashToken(token))
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Can the customer still change or cancel online? (Until 2 hours before; after that they call the salon.) */
export function canChangeOnline(booking, now = new Date()) {
  return booking.status === 'confirmed'
    && new Date(booking.starts_at).getTime() - now.getTime() >= bookingRules.changeCutoffMinutes * 60_000;
}

/**
 * Customer cancels from their private link.
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'not-found' | 'already-cancelled' | 'too-late' }>}
 */
export async function cancelByToken(token) {
  const booking = await getBookingByToken(token);
  if (!booking) return { ok: false, reason: 'not-found' };
  if (booking.status !== 'confirmed') return { ok: false, reason: 'already-cancelled' };
  if (!canChangeOnline(booking)) return { ok: false, reason: 'too-late' };
  const result = await cancelBooking(booking.id, 'customer');
  return result.ok ? { ok: true, bookingId: booking.id } : result;
}

/** Cancels a booking (customer or staff). Only touches it if it's still confirmed, so a double click is harmless. */
export async function cancelBooking(bookingId, by) {
  const { data, error } = await db().from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: by })
    .eq('id', bookingId).eq('status', 'confirmed')
    .select('id');
  if (error) throw error;
  return data.length ? { ok: true } : { ok: false, reason: 'already-cancelled' };
}

/**
 * Customer moves their booking to another time (same service, same stylist).
 * It's one database update, so it either fully happens or doesn't: they can never lose the old time without getting the new one.
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'not-found' | 'already-cancelled' | 'too-late' | 'taken' }>}
 */
export async function moveByToken(token, { date, time }) {
  const booking = await getBookingByToken(token);
  if (!booking) return { ok: false, reason: 'not-found' };
  if (booking.status !== 'confirmed') return { ok: false, reason: 'already-cancelled' };
  if (!canChangeOnline(booking)) return { ok: false, reason: 'too-late' };

  // Free times for their stylist, not counting their own current booking (so "30 minutes later" works)
  const slots = await findSlots({ date, serviceId: booking.service_id, staffId: booking.staff_id, ignoreBookingId: booking.id });
  const slot = slots.find((s) => s.time === time);
  if (!slot) return { ok: false, reason: 'taken' };

  const { data, error } = await db().from('bookings')
    .update({ starts_at: slot.startsAt, ends_at: slot.endsAt, moved_at: new Date().toISOString() })
    .eq('id', booking.id).eq('status', 'confirmed')
    .select('id');
  if (error?.code === SLOT_TAKEN) return { ok: false, reason: 'taken' };
  if (error) throw error;
  return data.length ? { ok: true, bookingId: booking.id } : { ok: false, reason: 'already-cancelled' };
}
