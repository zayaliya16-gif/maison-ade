// When reminders are due, when failed messages are retried, and reading WhatsApp webhooks (no database needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { remindersDue, retryDue } from '../src/lib/reminder-rules.js';
import { signatureValid, parseStatuses } from '../src/lib/messages/whatsapp-webhook.js';

const H = 3_600_000;
const START = new Date('2026-12-05T09:30:00Z');
const at = (hoursBefore) => new Date(START.getTime() - hoursBefore * H);
const booking = (bookedHoursBefore, status = 'confirmed') => ({ status, starts_at: START.toISOString(), created_at: at(bookedHoursBefore).toISOString() });

test('booked a week ahead: day-before reminder from 24h, the 2-hour one from 2h', () => {
  const b = booking(24 * 7);
  assert.deepEqual(remindersDue(b, at(25)), []);
  assert.deepEqual(remindersDue(b, at(24)), ['reminder_day']);
  assert.deepEqual(remindersDue(b, at(23.75)), ['reminder_day'], 'still due on the next run if the first was missed');
  assert.deepEqual(remindersDue(b, at(6)), [], 'too late for "tomorrow" once only 6 hours are left');
  assert.deepEqual(remindersDue(b, at(2)), ['reminder_soon']);
  assert.deepEqual(remindersDue(b, at(1)), ['reminder_soon']);
  assert.deepEqual(remindersDue(b, at(0.5)), [], 'not in the last 30 minutes');
  assert.deepEqual(remindersDue(b, at(-1)), [], 'never after it started');
});

test('booked only hours ahead: no day-before reminder; booked under 3h ahead: no 2-hour one either', () => {
  assert.deepEqual(remindersDue(booking(10), at(9)), []);
  assert.deepEqual(remindersDue(booking(10), at(2)), ['reminder_soon']);
  assert.deepEqual(remindersDue(booking(2.5), at(2)), []);
});

test('cancelled bookings never get reminders', () => {
  assert.deepEqual(remindersDue(booking(48, 'cancelled'), at(24)), []);
  assert.deepEqual(remindersDue(booking(48, 'cancelled'), at(2)), []);
});

test('failed messages wait longer after each try, and stop at the limit', () => {
  const now = new Date('2026-12-01T12:00:00Z');
  const tried = (minutesAgo, attempts) => ({ attempts, last_tried_at: new Date(now.getTime() - minutesAgo * 60_000).toISOString() });
  assert.equal(retryDue(tried(4, 1), 5, now), false);
  assert.equal(retryDue(tried(5, 1), 5, now), true);
  assert.equal(retryDue(tried(19, 2), 5, now), false);
  assert.equal(retryDue(tried(20, 2), 5, now), true);
  assert.equal(retryDue(tried(999, 5), 5, now), false, 'no more after 5 tries');
});

test('WhatsApp webhook: only requests signed with our app secret are accepted', () => {
  const body = '{"entry":[]}';
  const good = `sha256=${createHmac('sha256', 'app-secret').update(body).digest('hex')}`;
  assert.equal(signatureValid(body, good, 'app-secret'), true);
  assert.equal(signatureValid(`${body} `, good, 'app-secret'), false, 'changed body');
  assert.equal(signatureValid(body, good, 'other-secret'), false);
  assert.equal(signatureValid(body, undefined, 'app-secret'), false);
  assert.equal(signatureValid(body, good, ''), false, 'no secret set up = refuse everything');
});

test('WhatsApp webhook: delivered, read and failed statuses are understood', () => {
  const body = { entry: [{ changes: [{ value: { statuses: [
    { id: 'wamid.1', status: 'delivered', timestamp: '1764927000' },
    { id: 'wamid.2', status: 'read', timestamp: '1764927060' },
    { id: 'wamid.3', status: 'failed', timestamp: '1764927120', errors: [{ code: 131047, title: 'Re-engagement message' }] },
    { id: 'wamid.4', status: 'sent', timestamp: '1764927000' },
  ] } }] }] };
  const updates = parseStatuses(body);
  assert.equal(updates.length, 3, '"sent" is ignored (we already know)');
  assert.deepEqual(updates[0], { providerId: 'wamid.1', delivery: 'delivered', at: new Date(1764927000 * 1000).toISOString() });
  assert.equal(updates[1].delivery, 'read');
  assert.match(updates[2].error, /24 hours/);
  assert.deepEqual(parseStatuses({}), []);
  assert.deepEqual(parseStatuses({ entry: [{ changes: [{ value: { messages: [{}] } }] }] }), [], 'incoming chats are not statuses');
});
