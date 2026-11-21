import 'server-only';
import { db } from './supabase.js';
import { salon, bookingRules } from '../config/salon.js';
import { getAvailableSlots, lagosDayRange, weekdayOf } from './availability.js';

// Fetches everything the availability engine needs for one day from the database,
// then asks the engine for free slots. Used by the booking pages (phase 3).

/**
 * @param {object} p
 * @param {string} p.date        "YYYY-MM-DD" (Lagos)
 * @param {string} p.serviceId   e.g. "silk-press"
 * @param {string} [p.staffId]   a specific stylist, or leave out for "any stylist"
 */
export async function findSlots({ date, serviceId, staffId }) {
  const supabase = db();
  const weekday = weekdayOf(date); // also rejects bad dates
  const { from, to } = lagosDayRange(date);

  const { data: service, error: serviceError } = await supabase
    .from('services').select('id, minutes').eq('id', serviceId).eq('active', true).maybeSingle();
  if (serviceError) throw serviceError;
  if (!service) throw new Error(`Unknown service "${serviceId}"`);

  // Active stylists who do this service (or just the one asked for)
  let who = supabase.from('staff_services').select('staff_id, staff!inner(active)').eq('service_id', serviceId).eq('staff.active', true);
  if (staffId) who = who.eq('staff_id', staffId);
  const { data: qualified, error: whoError } = await who;
  if (whoError) throw whoError;
  const staffIds = qualified.map((row) => row.staff_id);
  if (staffIds.length === 0) return [];

  // Their hours that weekday, plus their time off and confirmed bookings that touch this day
  const [hours, timeOff, bookings] = await Promise.all([
    supabase.from('working_hours').select('staff_id, weekday, starts, ends').in('staff_id', staffIds).eq('weekday', weekday),
    supabase.from('time_off').select('staff_id, starts_at, ends_at').in('staff_id', staffIds)
      .lt('starts_at', to.toISOString()).gt('ends_at', from.toISOString()),
    supabase.from('bookings').select('staff_id, starts_at, ends_at').in('staff_id', staffIds).eq('status', 'confirmed')
      .lt('starts_at', to.toISOString()).gt('ends_at', from.toISOString()),
  ]);
  for (const result of [hours, timeOff, bookings]) if (result.error) throw result.error;

  return getAvailableSlots({
    date,
    serviceMinutes: service.minutes,
    staffIds,
    salonHours: salon.hours,
    workingHours: hours.data.map((h) => ({ staffId: h.staff_id, weekday: h.weekday, starts: h.starts, ends: h.ends })),
    busy: [...timeOff.data, ...bookings.data].map((b) => ({ staffId: b.staff_id, startsAt: b.starts_at, endsAt: b.ends_at })),
    rules: bookingRules,
  });
}
