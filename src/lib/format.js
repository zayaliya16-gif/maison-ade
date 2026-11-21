// Small display helpers, written by hand so the server and browser always
// produce exactly the same text (no locale differences).

/** 3500000 kobo → "₦35,000" */
export function naira(kobo) {
  return `₦${String(Math.round(kobo / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** 150 → "2 hrs 30 mins", 45 → "45 mins", 60 → "1 hr" */
export function duration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h ? `${h} hr${h === 1 ? '' : 's'}` : '';
  const mins = m ? `${m} mins` : '';
  return [hours, mins].filter(Boolean).join(' ');
}

/** "09:00" → "9:00 am", "17:30" → "5:30 pm" */
export function clock(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-12-05" → { weekday: "Sat", day: 5, month: "Dec" } (no time-zone surprises: it's just the calendar date) */
export function dayParts(date) {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { weekday: WEEKDAYS[weekday].slice(0, 3), longWeekday: WEEKDAYS[weekday], day: d, month: MONTHS[m - 1].slice(0, 3), longMonth: MONTHS[m - 1], year: y };
}

/** "2026-12-05" → "Sat 5 Dec" */
export function shortDate(date) {
  const p = dayParts(date);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "2026-12-05" → "Saturday 5 December 2026" */
export function longDate(date) {
  const p = dayParts(date);
  return `${p.longWeekday} ${p.day} ${p.longMonth} ${p.year}`;
}
