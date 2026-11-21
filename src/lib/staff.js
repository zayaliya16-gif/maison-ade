import 'server-only';
import { db } from './supabase.js';
import { lagosDayRange, lagosTime, parseDate, toMinutes, weekdayOf } from './availability.js';

// What the staff calendar reads and changes. Every caller must have checked requireStaff() first.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isUuid = (v) => UUID_RE.test(String(v));

/** Everything on the diary for one Lagos day: stylists, their hours, bookings (incl. cancelled) and time off */
export async function getStaffDay(date) {
  const supabase = db();
  const { from, to } = lagosDayRange(date);
  const [people, hours, bookings, timeOff] = await Promise.all([
    supabase.from('staff').select('id, name').eq('active', true),
    supabase.from('working_hours').select('staff_id, starts, ends').eq('weekday', weekdayOf(date)),
    supabase.from('bookings')
      .select('id, staff_id, starts_at, ends_at, status, cancelled_by, moved_at, customer_name, customer_phone, customer_email, price_kobo, service:services(name)')
      .lt('starts_at', to.toISOString()).gt('ends_at', from.toISOString()).order('starts_at'),
    supabase.from('time_off').select('id, staff_id, starts_at, ends_at, reason')
      .lt('starts_at', to.toISOString()).gt('ends_at', from.toISOString()).order('starts_at'),
  ]);
  for (const r of [people, hours, bookings, timeOff]) if (r.error) throw r.error;
  return { staff: people.data, hours: hours.data, bookings: bookings.data, timeOff: timeOff.data };
}

/**
 * Blocks time for a stylist. Times are Lagos; leave a time blank for "start of day" / "end of day".
 * @param {{ staffId, startDate, startTime?, endDate, endTime?, reason? }} input  raw form values
 * @returns {Promise<{ ok: true, clashes: number } | { ok: false, error: string }>}
 *   clashes = confirmed bookings already inside that time (they are NOT cancelled automatically)
 */
export async function addTimeOff(input) {
  const supabase = db();
  const reason = String(input.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || null;
  let startsAt, endsAt;
  try {
    parseDate(input.startDate);
    parseDate(input.endDate);
    startsAt = lagosTime(input.startDate, input.startTime ? toMinutes(input.startTime) : 0);
    endsAt = lagosTime(input.endDate, input.endTime ? toMinutes(input.endTime) : 24 * 60);
  } catch {
    return { ok: false, error: 'Please give a valid start and end.' };
  }
  if (endsAt <= startsAt) return { ok: false, error: 'The end must be after the start.' };
  if (endsAt - startsAt > 366 * 86_400_000) return { ok: false, error: 'Time off can be at most a year at a time.' };

  const { data: person, error: personError } = await supabase.from('staff').select('id').eq('id', String(input.staffId)).maybeSingle();
  if (personError) throw personError;
  if (!person) return { ok: false, error: 'Please choose a stylist.' };

  const { error } = await supabase.from('time_off').insert({ staff_id: person.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), reason });
  if (error) throw error;

  const { count, error: countError } = await supabase.from('bookings').select('id', { count: 'exact', head: true })
    .eq('staff_id', person.id).eq('status', 'confirmed').lt('starts_at', endsAt.toISOString()).gt('ends_at', startsAt.toISOString());
  if (countError) throw countError;
  return { ok: true, clashes: count };
}

export async function removeTimeOff(id) {
  if (!isUuid(id)) return { ok: false };
  const { error } = await db().from('time_off').delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}
