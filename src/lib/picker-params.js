import { bookingRules } from '../config/salon.js';
import { addDays, lagosToday, parseDate } from './availability.js';

// Reads week/date/time from a page address for the day-and-time picker.
// Anything invalid or outside the bookable range is ignored, never trusted.

const one = (v) => (Array.isArray(v) ? v[0] : v) ?? '';
const isDate = (v) => { try { parseDate(v); return true; } catch { return false; } };

export function readPickerParams(q, now = new Date()) {
  const today = lagosToday(now);
  const lastDay = addDays(today, bookingRules.maxDaysAhead);
  const inRange = (d) => isDate(d) && d >= today && d <= lastDay;

  const date = inRange(one(q.date)) ? one(q.date) : null;
  let week = inRange(one(q.week)) ? one(q.week) : (date ?? today);
  if (date && (date < week || date > addDays(week, 6))) week = date; // the week shown always contains the chosen day
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i)).filter((d) => d <= lastDay);

  return { today, lastDay, date, week, weekDays, time: one(q.time) };
}
