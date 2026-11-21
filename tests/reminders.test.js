// The reminder clock against the real database, with a made-up "now" and FAKE senders (nothing really sent).
// Needs .env.local (skipped otherwise). Uses a made-up phone number and cleans up after itself.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const skip = !SUPABASE_URL || !SUPABASE_SECRET_KEY ? 'no Supabase details in .env.local' : false;
const supabase = skip ? null : createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const TEST_PHONE = '+99900000006';
const H = 3_600_000;
let lib;

const cleanUp = () => supabase.from('bookings').delete().eq('customer_phone', TEST_PHONE); // their messages go too

/** Fake senders that only count messages for our test booking (other real bookings may be due at the same made-up time) */
function fakeSenders() {
  const sent = [];
  const send = (channel) => async (m) => {
    if (m.to === TEST_PHONE || m.to === 'test@example.com') sent.push({ channel, ...m });
    return { ok: true, id: `fake-${Math.random()}` };
  };
  return { sent, senders: { email: send('email'), whatsapp: send('whatsapp') } };
}
const failing = { email: async () => ({ ok: false, retry: true, error: 'busy' }), whatsapp: async () => ({ ok: false, retry: true, error: 'busy' }) };

async function newBooking() {
  for (let i = 9; i < 40; i++) {
    const date = lib.addDays(lib.lagosToday(), i);
    for (const slot of await lib.findSlots({ date, serviceId: 'trim', staffId: 'tolu' })) {
      const r = await lib.createBooking({ serviceId: 'trim', staffChoice: 'tolu', date, time: slot.time,
        customer: { name: 'Test Customer', phone: TEST_PHONE, email: 'test@example.com', whatsappOptIn: true, emailOptIn: true } });
      if (r.ok) return { ...r, startsAt: new Date(slot.startsAt) };
      if (r.reason === 'limit') await cleanUp();
    }
  }
  throw new Error('No free time');
}
const rowsFor = async (bookingId) => (await supabase.from('messages').select('kind, channel, status, error').eq('booking_id', bookingId)).data;

before(async () => {
  if (skip) return;
  const check = await supabase.from('messages').select('delivery').limit(1);
  if (check.error) throw new Error(`The database isn't ready (${check.error.message}). Run supabase/migrations/0006_reminders.sql.`);
  lib = {
    ...(await import('../src/lib/reminders.js')),
    ...(await import('../src/lib/messages/outbox.js')),
    ...(await import('../src/lib/booking.js')),
    ...(await import('../src/lib/schedule.js')),
    ...(await import('../src/lib/availability.js')),
  };
  await cleanUp();
});
after(async () => { if (!skip) await cleanUp(); });

test('the day-before and 2-hour reminders each go out once, by email and WhatsApp', { skip }, async () => {
  const { bookingId, startsAt } = await newBooking();
  const fake = fakeSenders();
  const run = (hoursBefore) => lib.runReminders({ now: new Date(startsAt.getTime() - hoursBefore * H), senders: fake.senders });

  await run(23.9);
  await run(23.6); // the next 15-minute run: nothing new
  assert.equal(fake.sent.length, 2, 'one email + one WhatsApp the day before');

  await run(1.9);
  await run(1.6);
  assert.equal(fake.sent.length, 4, 'plus one email + one WhatsApp 2 hours before, never repeated');

  const rows = await rowsFor(bookingId);
  assert.deepEqual(rows.map((r) => `${r.kind}/${r.channel}/${r.status}`).sort(),
    ['reminder_day/email/sent', 'reminder_day/whatsapp/sent', 'reminder_soon/email/sent', 'reminder_soon/whatsapp/sent']);
  await cleanUp();
});

test('a reminder queued before a cancellation is never sent', { skip }, async () => {
  const { bookingId, startsAt } = await newBooking();
  const now = new Date(startsAt.getTime() - 23.9 * H);
  const ids = await lib.queueMessages(bookingId, 'reminder_day'); // queued...
  await lib.cancelBooking(bookingId, 'customer'); // ...then cancelled before it was sent
  const fake = fakeSenders();
  for (const id of ids) assert.equal(await lib.deliver(id, fake.senders, now), 'skipped');
  assert.equal(fake.sent.length, 0);
  assert.ok((await rowsFor(bookingId)).every((r) => /cancelled first/.test(r.error)));
  await cleanUp();
});

test('a temporary failure is retried by the clock once its wait is over', { skip }, async () => {
  const { bookingId, startsAt } = await newBooking();
  const ids = await lib.queueMessages(bookingId, 'reminder_day');
  for (const id of ids) assert.equal(await lib.deliver(id, failing, new Date(startsAt.getTime() - 23.9 * H)), 'failed');

  // last_tried_at is the real time now, so run the clock 6 minutes later (after the 5-minute wait)
  const fake = fakeSenders();
  await lib.runReminders({ now: new Date(Date.now() + 6 * 60_000), senders: fake.senders });
  const rows = (await rowsFor(bookingId)).filter((r) => r.kind === 'reminder_day');
  assert.ok(rows.length === 2 && rows.every((r) => r.status === 'sent'), JSON.stringify(rows));
  await cleanUp();
});
