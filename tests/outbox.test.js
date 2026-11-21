// The message outbox against the real database, with FAKE senders: nothing is really emailed or WhatsApped.
// Needs .env.local (skipped otherwise). Uses a made-up phone number and cleans up after itself.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const skip = !SUPABASE_URL || !SUPABASE_SECRET_KEY ? 'no Supabase details in .env.local' : false;
const supabase = skip ? null : createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const TEST_PHONE = '+99900000005';
let lib;
const cleanUp = () => supabase.from('bookings').delete().eq('customer_phone', TEST_PHONE); // messages go with them

/** Fake senders that record what they were asked to send */
function fakeSenders(result = { ok: true, id: 'fake-id' }) {
  const sent = [];
  const send = (channel) => async (message) => { sent.push({ channel, ...message }); return typeof result === 'function' ? result(channel) : result; };
  return { sent, senders: { email: send('email'), whatsapp: send('whatsapp') } };
}

async function newBooking({ email = 'test@example.com', emailOptIn = true, whatsappOptIn = true } = {}) {
  for (let i = 8; i < 40; i++) {
    const date = lib.addDays(lib.lagosToday(), i);
    const slots = await lib.findSlots({ date, serviceId: 'trim', staffId: 'tolu' });
    for (const slot of slots) {
      const r = await lib.createBooking({ serviceId: 'trim', staffChoice: 'tolu', date, time: slot.time,
        customer: { name: 'Test Customer', phone: TEST_PHONE, email, whatsappOptIn, emailOptIn } });
      if (r.ok) return r;
      if (r.reason === 'limit') { await cleanUp(); continue; }
    }
  }
  throw new Error('No free time found');
}
const messagesFor = async (bookingId) => (await supabase.from('messages').select('*').eq('booking_id', bookingId).order('channel')).data;

before(async () => {
  if (skip) return;
  const check = await supabase.from('messages').select('id').limit(1);
  if (check.error) throw new Error(`The database isn't ready (${check.error.message}). Run supabase/migrations/0005_messages.sql.`);
  lib = {
    ...(await import('../src/lib/messages/outbox.js')),
    ...(await import('../src/lib/booking.js')),
    ...(await import('../src/lib/schedule.js')),
    ...(await import('../src/lib/availability.js')),
  };
  await cleanUp();
});
after(async () => { if (!skip) await cleanUp(); });

test('a booking queues one message per channel the customer agreed to', { skip }, async () => {
  const both = await newBooking();
  assert.equal((await lib.queueMessages(both.bookingId, 'confirmed')).length, 2);

  const whatsappOnly = await newBooking({ email: null, emailOptIn: false });
  assert.equal((await lib.queueMessages(whatsappOnly.bookingId, 'confirmed')).length, 1);

  const none = await newBooking({ email: null, emailOptIn: false, whatsappOptIn: false });
  assert.deepEqual(await lib.queueMessages(none.bookingId, 'confirmed'), []);
  await cleanUp();
});

test('never twice: queueing again adds nothing, and sending again sends nothing', { skip }, async () => {
  const { bookingId } = await newBooking();
  const ids = await lib.queueMessages(bookingId, 'confirmed');
  assert.deepEqual(await lib.queueMessages(bookingId, 'confirmed'), [], 'second queue creates nothing');

  const fake = fakeSenders();
  for (const id of ids) assert.equal(await lib.deliver(id, fake.senders), 'sent');
  for (const id of ids) assert.equal(await lib.deliver(id, fake.senders), 'done', 'already sent');
  assert.equal(fake.sent.length, 2, 'exactly one email and one WhatsApp');

  const rows = await messagesFor(bookingId);
  assert.ok(rows.every((r) => r.status === 'sent' && r.provider_id === 'fake-id' && r.attempts === 1));
  await cleanUp();
});

test('two workers sending at once: only one actually sends', { skip }, async () => {
  const { bookingId } = await newBooking({ email: null, emailOptIn: false });
  const [id] = await lib.queueMessages(bookingId, 'confirmed');
  const fake = fakeSenders();
  const results = await Promise.all([lib.deliver(id, fake.senders), lib.deliver(id, fake.senders), lib.deliver(id, fake.senders)]);
  assert.equal(fake.sent.length, 1, `sent once (results: ${results})`);
  await cleanUp();
});

test('the message has the right details and a private link that really opens the booking', { skip }, async () => {
  const { bookingId, token } = await newBooking();
  const [id] = await lib.queueMessages(bookingId, 'confirmed');
  const fake = fakeSenders();
  await lib.deliver(id, fake.senders);
  const sent = fake.sent[0];
  const body = sent.text ?? '';
  assert.ok(body.includes(`/b/${token}`), 'link in the message matches the booking link');
  assert.ok(body.includes('Trim and shape with Tolu'));
  assert.equal((await lib.getBookingByToken(token)).id, bookingId);
  await cleanUp();
});

test('a temporary failure can be retried; a permanent one is not retried', { skip }, async () => {
  const { bookingId } = await newBooking();
  const ids = await lib.queueMessages(bookingId, 'confirmed');
  const failing = fakeSenders((channel) => channel === 'email'
    ? { ok: false, retry: true, error: 'Resend is busy' }
    : { ok: false, retry: false, error: 'Wrong number' });
  for (const id of ids) assert.equal(await lib.deliver(id, failing.senders), 'failed');

  const rows = await messagesFor(bookingId);
  const email = rows.find((r) => r.channel === 'email');
  const whatsapp = rows.find((r) => r.channel === 'whatsapp');
  assert.equal(email.attempts, 1);
  assert.equal(whatsapp.attempts, lib.MAX_ATTEMPTS, 'permanent failure uses up the tries');

  const ok = fakeSenders();
  assert.equal(await lib.deliver(email.id, ok.senders), 'sent', 'the busy one goes through on retry');
  assert.equal(await lib.deliver(whatsapp.id, ok.senders), 'done', 'the wrong number is not retried');
  await cleanUp();
});

test('services not set up: messages are logged as "not sent" and booking is unaffected', { skip }, async () => {
  const { bookingId } = await newBooking();
  const ids = await lib.queueMessages(bookingId, 'confirmed');
  const notSetUp = fakeSenders({ ok: false, skipped: true, error: 'Email isn’t set up' });
  for (const id of ids) assert.equal(await lib.deliver(id, notSetUp.senders), 'skipped');
  const booking = (await supabase.from('bookings').select('status').eq('id', bookingId).single()).data;
  assert.equal(booking.status, 'confirmed');
  await cleanUp();
});

test('a moved booking gets its own "moved" message', { skip }, async () => {
  const { bookingId } = await newBooking({ email: null, emailOptIn: false });
  await lib.queueMessages(bookingId, 'confirmed');
  assert.equal((await lib.queueMessages(bookingId, 'moved')).length, 1);
  assert.equal((await lib.queueMessages(bookingId, 'cancelled')).length, 1);
  assert.equal((await messagesFor(bookingId)).length, 3);
  await cleanUp();
});
