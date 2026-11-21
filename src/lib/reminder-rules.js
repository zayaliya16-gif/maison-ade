// When reminders are due, and when a failed message should be tried again. Pure (just times), so fully tested.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const REMINDERS = {
  // The day before: from 24 hours ahead until 6 hours ahead (the clock runs every 15 minutes, so ~24h before).
  // Not for bookings made less than a day ahead: they've only just had their confirmation.
  reminder_day: { from: 24 * HOUR, until: 6 * HOUR, bookedAtLeast: 24 * HOUR },
  // About 2 hours before: from 2 hours ahead until 30 minutes ahead.
  // Not for bookings made less than 3 hours ahead.
  reminder_soon: { from: 2 * HOUR, until: 30 * MINUTE, bookedAtLeast: 3 * HOUR },
};

/**
 * Which reminders are due for a booking right now.
 * @param {{ starts_at: string, created_at: string, status: string }} booking
 * @returns {string[]} e.g. ['reminder_soon']
 */
export function remindersDue(booking, now = new Date()) {
  if (booking.status !== 'confirmed') return [];
  const startsAt = new Date(booking.starts_at).getTime();
  const createdAt = new Date(booking.created_at).getTime();
  const untilStart = startsAt - now.getTime();
  return Object.entries(REMINDERS)
    .filter(([, r]) => untilStart <= r.from && untilStart > r.until && startsAt - createdAt >= r.bookedAtLeast)
    .map(([kind]) => kind);
}

/**
 * Should a failed message be tried again yet? Waits longer after each try: 5, 20, 45, 80 minutes.
 * @param {{ attempts: number, last_tried_at: string }} message
 */
export function retryDue(message, maxAttempts, now = new Date()) {
  if (message.attempts >= maxAttempts) return false;
  if (!message.last_tried_at) return true;
  const wait = 5 * MINUTE * message.attempts ** 2;
  return now.getTime() - new Date(message.last_tried_at).getTime() >= wait;
}
