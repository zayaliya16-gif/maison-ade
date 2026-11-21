// ─────────────────────────────────────────────────────────────
// The availability engine: which start times are free for a service on a day?
//
// free = salon opening hours
//        ∩ the stylist's working hours
//        − their time off
//        − their existing bookings
//        − anything too soon (minimum notice) or too far ahead
//
// This file is "pure": it only does maths on what it's given, never touches the database.
// That makes it easy to test with made-up schedules (tests/availability.test.js).
// All times are Lagos time (UTC+1 all year, no daylight saving).
// ─────────────────────────────────────────────────────────────

const LAGOS_OFFSET_MINUTES = 60;
const MINUTE = 60_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(:00)?$/; // accepts "09:00" and the database's "09:00:00"

/** "2026-12-05" → { y, m, d }, or throws if it isn't a real calendar date */
export function parseDate(date) {
  const match = DATE_RE.exec(String(date));
  if (!match) throw new Error(`Invalid date "${date}" (expected YYYY-MM-DD)`);
  const [y, m, d] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new Error(`Invalid date "${date}" (no such day)`);
  }
  return { y, m, d };
}

/** "09:30" → 570 minutes after midnight */
export function toMinutes(hhmm) {
  const match = TIME_RE.exec(String(hhmm));
  if (!match) throw new Error(`Invalid time "${hhmm}" (expected HH:MM)`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 570 → "09:30" */
export function fromMinutes(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Day of the week for a date (0 = Sunday) */
export function weekdayOf(date) {
  const { y, m, d } = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** A Lagos wall-clock time on a date → the exact moment (a JS Date) */
export function lagosTime(date, minutesAfterMidnight) {
  const { y, m, d } = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d) + (minutesAfterMidnight - LAGOS_OFFSET_MINUTES) * MINUTE);
}

/** The exact start and end of a Lagos day, for fetching that day's bookings */
export function lagosDayRange(date) {
  return { from: lagosTime(date, 0), to: lagosTime(date, 24 * 60) };
}

/** Today's date in Lagos as "YYYY-MM-DD" */
export function lagosToday(now = new Date()) {
  return new Date(now.getTime() + LAGOS_OFFSET_MINUTES * MINUTE).toISOString().slice(0, 10);
}

/**
 * Free start times for one service on one day.
 *
 * @param {object} p
 * @param {string} p.date            "YYYY-MM-DD" (Lagos)
 * @param {number} p.serviceMinutes  how long the service takes
 * @param {string[]} p.staffIds      stylists to consider (already filtered to those who do the service)
 * @param {object} p.salonHours      { 0: {open, close} | null, ... } from salon.js
 * @param {Array<{staffId, weekday, starts, ends}>} p.workingHours
 * @param {Array<{staffId, startsAt, endsAt}>} p.busy  time off + confirmed bookings (Dates or ISO strings)
 * @param {object} p.rules           { stepMinutes, minNoticeMinutes, maxDaysAhead }
 * @param {Date}   [p.now]           the current moment (tests pass a fixed one)
 * @returns {Array<{time: string, startsAt: string, endsAt: string, staffIds: string[]}>}
 *          e.g. { time: "09:00", startsAt: "2026-12-05T08:00:00.000Z", ..., staffIds: ["tolu", "kemi"] }
 */
export function getAvailableSlots({ date, serviceMinutes, staffIds, salonHours, workingHours, busy, rules, now = new Date() }) {
  const weekday = weekdayOf(date); // also rejects bad dates
  if (!Number.isInteger(serviceMinutes) || serviceMinutes <= 0) throw new Error('serviceMinutes must be a positive whole number');

  const salon = salonHours[weekday];
  if (!salon) return []; // salon closed that day

  const step = rules.stepMinutes;
  const earliest = now.getTime() + rules.minNoticeMinutes * MINUTE;
  const latest = now.getTime() + rules.maxDaysAhead * 24 * 60 * MINUTE;

  // Busy periods as plain numbers, grouped by stylist
  const busyByStaff = new Map();
  for (const b of busy) {
    const list = busyByStaff.get(b.staffId) ?? [];
    list.push([new Date(b.startsAt).getTime(), new Date(b.endsAt).getTime()]);
    busyByStaff.set(b.staffId, list);
  }

  const slots = new Map(); // "09:00" → slot
  for (const staffId of staffIds) {
    const shift = workingHours.find((w) => w.staffId === staffId && Number(w.weekday) === weekday);
    if (!shift) continue; // their day off

    // They can only work while both they and the salon are open
    const open = Math.max(toMinutes(salon.open), toMinutes(shift.starts));
    const close = Math.min(toMinutes(salon.close), toMinutes(shift.ends));
    const firstStart = Math.ceil(open / step) * step; // line up with 9:00, 9:15, 9:30...
    const theirBusy = busyByStaff.get(staffId) ?? [];

    for (let start = firstStart; start + serviceMinutes <= close; start += step) {
      const s = lagosTime(date, start).getTime();
      const e = s + serviceMinutes * MINUTE;
      if (s < earliest || s > latest) continue;
      // Two periods clash if each starts before the other ends. Touching (one ends 10:00, next starts 10:00) is fine.
      if (theirBusy.some(([bs, be]) => s < be && bs < e)) continue;

      const time = fromMinutes(start);
      const slot = slots.get(time) ?? { time, startsAt: new Date(s).toISOString(), endsAt: new Date(e).toISOString(), staffIds: [] };
      slot.staffIds.push(staffId);
      slots.set(time, slot);
    }
  }

  return [...slots.values()].sort((a, b) => a.time.localeCompare(b.time));
}
