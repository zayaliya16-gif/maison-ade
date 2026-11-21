import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { db } from './supabase.js';
import { findSlots, getService } from './schedule.js';
import { lagosDayRange } from './availability.js';
import { rankStylists } from './booking-input.js';

// Creating bookings and looking them up by their private link.

export const MAX_UPCOMING_PER_PHONE = 3;
const SLOT_TAKEN = '23P01'; // Postgres: the no_double_booking rule refused it

/** The private link code is shown to the customer once; the database only keeps its fingerprint (hash). */
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, written in URL-safe letters

/**
 * Books an appointment. Everything is checked again here; nothing from the browser is trusted.
 * @param {object} p
 * @param {string} p.serviceId
 * @param {string} p.staffChoice  a stylist id, or "any"
 * @param {string} p.date         "YYYY-MM-DD" (Lagos)
 * @param {string} p.time         "HH:MM" (Lagos)
 * @param {object} p.customer     from parseCustomer(): { name, phone, email, whatsappOptIn, emailOptIn }
 * @returns {Promise<{ ok: true, token: string } | { ok: false, reason: 'taken' | 'limit' }>}
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

  const token = randomBytes(32).toString('base64url');
  for (const staffId of candidates) {
    const { error } = await supabase.from('bookings').insert({
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
    if (!error) return { ok: true, token };
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
    .select('id, starts_at, ends_at, status, customer_name, customer_phone, customer_email, whatsapp_opt_in, email_opt_in, price_kobo, service:services(id, name, minutes), stylist:staff(id, name)')
    .eq('manage_token_hash', hashToken(token))
    .maybeSingle();
  if (error) throw error;
  return data;
}
