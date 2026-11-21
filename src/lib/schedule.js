import 'server-only';
import { db } from './supabase.js';
import { salon, bookingRules } from '../config/salon.js';
import { getAvailableSlots, lagosDayRange } from './availability.js';

// Fetches what the availability engine needs from the database, then asks it for free slots.
// Several days are loaded in one go (for the week view), so a week costs the same few queries as one day.

/** A service from the database (only active ones), or null */
export async function getService(serviceId) {
  const { data, error } = await db()
    .from('services').select('id, name, minutes, price_kobo').eq('id', serviceId).eq('active', true).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Free slots for each of several days.
 * @param {object} p
 * @param {string}   p.serviceId  e.g. "silk-press"
 * @param {string}   [p.staffId]  a specific stylist, or leave out for "any stylist"
 * @param {string[]} p.dates      "YYYY-MM-DD" days (Lagos), in order
 * @returns {Promise<Map<string, Array>>} date → slots (see getAvailableSlots)
 */
export async function findSlotsForDays({ serviceId, staffId, dates }) {
  const supabase = db();
  const result = new Map(dates.map((d) => [d, []]));
  if (dates.length === 0) return result;

  const service = await getService(serviceId);
  if (!service) throw new Error(`Unknown service "${serviceId}"`);

  // Active stylists who do this service (or just the one asked for)
  let who = supabase.from('staff_services').select('staff_id, staff!inner(active)').eq('service_id', serviceId).eq('staff.active', true);
  if (staffId) who = who.eq('staff_id', staffId);
  const { data: qualified, error: whoError } = await who;
  if (whoError) throw whoError;
  const staffIds = qualified.map((row) => row.staff_id);
  if (staffIds.length === 0) return result;

  // Everything from the start of the first day to the end of the last
  const from = lagosDayRange(dates[0]).from.toISOString();
  const to = lagosDayRange(dates.at(-1)).to.toISOString();
  const [hours, timeOff, bookings] = await Promise.all([
    supabase.from('working_hours').select('staff_id, weekday, starts, ends').in('staff_id', staffIds),
    supabase.from('time_off').select('staff_id, starts_at, ends_at').in('staff_id', staffIds).lt('starts_at', to).gt('ends_at', from),
    supabase.from('bookings').select('staff_id, starts_at, ends_at').in('staff_id', staffIds).eq('status', 'confirmed').lt('starts_at', to).gt('ends_at', from),
  ]);
  for (const r of [hours, timeOff, bookings]) if (r.error) throw r.error;

  const workingHours = hours.data.map((h) => ({ staffId: h.staff_id, weekday: h.weekday, starts: h.starts, ends: h.ends }));
  const busy = [...timeOff.data, ...bookings.data].map((b) => ({ staffId: b.staff_id, startsAt: b.starts_at, endsAt: b.ends_at }));

  for (const date of dates) {
    result.set(date, getAvailableSlots({
      date, serviceMinutes: service.minutes, staffIds, salonHours: salon.hours, workingHours, busy, rules: bookingRules,
    }));
  }
  return result;
}

/** Free slots for one day. Same options as findSlotsForDays, with `date` instead of `dates`. */
export async function findSlots({ date, serviceId, staffId }) {
  return (await findSlotsForDays({ serviceId, staffId, dates: [date] })).get(date);
}
