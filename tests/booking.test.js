// Real bookings against the real database, through the same code the website uses.
// Needs .env.local (skipped otherwise). Uses a made-up phone number and deletes its bookings afterwards.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const skip = !SUPABASE_URL || !SUPABASE_SECRET_KEY ? 'no Supabase details in .env.local' : false;
const supabase = skip ? null : createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const TEST_PHONE = '+99900000001'; // +999 isn't a real country code, so this can never be a customer
const customer = { name: 'Test Customer', phone: TEST_PHONE, email: null, whatsappOptIn: true, emailOptIn: false };
let lib; // loaded in before(), so a skipped run never touches the database code

const cleanUp = () => supabase.from('bookings').delete().eq('customer_phone', TEST_PHONE);

/** The first day (from a week ahead) when this stylist has at least `n` free slots for a service (trims unless said) */
async function freeDay(staffId, n, serviceId = 'trim') {
  const { addDays, lagosToday } = await import('../src/lib/availability.js');
  for (let i = 7; i < 40; i++) {
    const date = addDays(lagosToday(), i);
    const slots = await lib.findSlots({ date, serviceId, staffId });
    if (slots.length >= n) return { date, slots };
  }
  throw new Error(`No free day found for ${staffId}`);
}

before(async () => {
  if (skip) return;
  const { error } = await supabase.from('bookings').select('whatsapp_opt_in').limit(1);
  if (error) throw new Error(`The database isn't ready (${error.message}). Run supabase/migrations/0003_booking.sql.`);
  await cleanUp();
  lib = { ...(await import('../src/lib/booking.js')), ...(await import('../src/lib/schedule.js')) };
});

after(async () => { if (!skip) await cleanUp(); });

test('booking a free time works, and the private link finds it', { skip }, async () => {
  const { date, slots } = await freeDay('tolu', 1);
  const result = await lib.createBooking({ serviceId: 'trim', staffChoice: 'tolu', date, time: slots[0].time, customer });
  assert.equal(result.ok, true);
  assert.match(result.token, /^[A-Za-z0-9_-]{43}$/);

  const booking = await lib.getBookingByToken(result.token);
  assert.equal(booking.stylist.id, 'tolu');
  assert.equal(booking.service.name, 'Trim and shape');
  assert.equal(booking.starts_at.slice(0, 16), slots[0].startsAt.slice(0, 16));
  assert.equal(booking.price_kobo, 1000000);

  // The time is no longer offered, and booking it again is refused
  const after = await lib.findSlots({ date, serviceId: 'trim', staffId: 'tolu' });
  assert.ok(!after.some((s) => s.time === slots[0].time));
  const again = await lib.createBooking({ serviceId: 'trim', staffChoice: 'tolu', date, time: slots[0].time, customer: { ...customer, phone: '+99900000002' } });
  assert.deepEqual(again, { ok: false, reason: 'taken' });
});

test('wrong or made-up links find nothing', { skip }, async () => {
  assert.equal(await lib.getBookingByToken('x'.repeat(43)), null);
  assert.equal(await lib.getBookingByToken('not-a-token'), null);
  assert.equal(await lib.getBookingByToken(''), null);
  assert.equal(await lib.getBookingByToken("' or 1=1 --"), null);
});

test("booking on a stylist's day off is refused", { skip }, async () => {
  const { addDays, lagosToday, weekdayOf } = await import('../src/lib/availability.js');
  let sunday = addDays(lagosToday(), 7);
  while (weekdayOf(sunday) !== 0) sunday = addDays(sunday, 1);
  const result = await lib.createBooking({ serviceId: 'trim', staffChoice: 'tolu', date: sunday, time: '13:00', customer }); // Sunday = Tolu's day off
  assert.deepEqual(result, { ok: false, reason: 'taken' });
});

test('a stylist who does not do the service cannot be booked for it', { skip }, async () => {
  const { date, slots } = await freeDay('zainab', 1, 'brows'); // a day Zainab is working and free
  const result = await lib.createBooking({ serviceId: 'silk-press', staffChoice: 'zainab', date, time: slots[0].time, customer });
  assert.deepEqual(result, { ok: false, reason: 'taken' });
});

test('"any stylist" books someone who does the service', { skip }, async () => {
  const { date, slots } = await freeDay(undefined, 1);
  const result = await lib.createBooking({ serviceId: 'trim', staffChoice: 'any', date, time: slots.at(-1).time, customer });
  assert.equal(result.ok, true);
  const booking = await lib.getBookingByToken(result.token);
  assert.ok(['tolu', 'ifeoma'].includes(booking.stylist.id)); // the two who do trims
});

test('one phone number can have at most 3 upcoming bookings', { skip }, async () => {
  await cleanUp();
  const { date, slots } = await freeDay('ifeoma', 12);
  // 30-minute trims, every hour, so they never overlap
  for (const i of [0, 4, 8]) {
    const r = await lib.createBooking({ serviceId: 'trim', staffChoice: 'ifeoma', date, time: slots[i].time, customer });
    assert.equal(r.ok, true, `booking ${i}`);
  }
  const fourth = await lib.createBooking({ serviceId: 'trim', staffChoice: 'ifeoma', date, time: slots[11].time, customer });
  assert.deepEqual(fourth, { ok: false, reason: 'limit' });
});

test('one place (visitor) can make at most 5 bookings an hour, even with different phone numbers', { skip }, async () => {
  const visitor = 'f'.repeat(64); // a made-up fingerprint
  const phones = ['+99900000011', '+99900000012', '+99900000013', '+99900000014', '+99900000015', '+99900000016'];
  try {
    const { date, slots } = await freeDay('ifeoma', 14);
    for (let i = 0; i < 5; i++) {
      const r = await lib.createBooking({ serviceId: 'trim', staffChoice: 'ifeoma', date, time: slots[i * 2].time, customer: { ...customer, phone: phones[i] }, visitor });
      assert.equal(r.ok, true, `booking ${i + 1}`);
    }
    const sixth = await lib.createBooking({ serviceId: 'trim', staffChoice: 'ifeoma', date, time: slots[12].time, customer: { ...customer, phone: phones[5] }, visitor });
    assert.deepEqual(sixth, { ok: false, reason: 'busy' });
  } finally {
    await supabase.from('bookings').delete().in('customer_phone', phones);
  }
});
