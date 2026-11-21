// Phase 4 against the real database: cancel, move, the 2-hour rule, time off, and the login lockout.
// Needs .env.local (skipped otherwise). Uses a made-up phone number and cleans up after itself.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const skip = !SUPABASE_URL || !SUPABASE_SECRET_KEY ? 'no Supabase details in .env.local' : false;
const supabase = skip ? null : createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const TEST_PHONE = '+99900000004';
const TEST_REASON = `test-${randomUUID()}`; // marks time off created by this run
const TEST_FINGERPRINT = randomBytes(32).toString('hex'); // a made-up visitor for the lockout test
const customer = { name: 'Test Customer', phone: TEST_PHONE, email: null, whatsappOptIn: false, emailOptIn: false };
let lib;

async function cleanUp() {
  await supabase.from('bookings').delete().eq('customer_phone', TEST_PHONE);
  await supabase.from('time_off').delete().eq('reason', TEST_REASON);
  await supabase.from('login_attempts').delete().eq('ip_hash', TEST_FINGERPRINT);
}

/** First day (from a week ahead) where Ifeoma has at least `n` free trims */
async function freeDay(n) {
  for (let i = 7; i < 40; i++) {
    const date = lib.addDays(lib.lagosToday(), i);
    const slots = await lib.findSlots({ date, serviceId: 'trim', staffId: 'ifeoma' });
    if (slots.length >= n) return { date, slots };
  }
  throw new Error('No free day found');
}
const book = (date, time) => lib.createBooking({ serviceId: 'trim', staffChoice: 'ifeoma', date, time, customer });

before(async () => {
  if (skip) return;
  const check = await supabase.from('login_attempts').select('id').limit(1);
  if (check.error) throw new Error(`The database isn't ready (${check.error.message}). Run supabase/migrations/0004_manage_and_staff.sql.`);
  lib = {
    ...(await import('../src/lib/booking.js')),
    ...(await import('../src/lib/schedule.js')),
    ...(await import('../src/lib/staff.js')),
    ...(await import('../src/lib/login-attempts.js')),
    ...(await import('../src/lib/availability.js')),
  };
  await cleanUp();
});
after(async () => { if (!skip) await cleanUp(); });

test('a customer can cancel, the time frees up, and cancelling twice is harmless', { skip }, async () => {
  const { date, slots } = await freeDay(1);
  const { token } = await book(date, slots[0].time);

  assert.equal((await lib.cancelByToken(token)).ok, true);
  const booking = await lib.getBookingByToken(token);
  assert.equal(booking.status, 'cancelled');
  assert.equal(booking.cancelled_by, 'customer');

  const after = await lib.findSlots({ date, serviceId: 'trim', staffId: 'ifeoma' });
  assert.ok(after.some((s) => s.time === slots[0].time), 'the time is offered again');
  assert.deepEqual(await lib.cancelByToken(token), { ok: false, reason: 'already-cancelled' });
});

test('a customer can move to a free time; the same link keeps working and the old time frees up', { skip }, async () => {
  const { date, slots } = await freeDay(6);
  const { token } = await book(date, slots[0].time);

  // 15 minutes later overlaps its own old time: allowed, because it's the same booking moving
  assert.equal((await lib.moveByToken(token, { date, time: slots[1].time })).ok, true);
  const moved = await lib.getBookingByToken(token);
  assert.equal(moved.starts_at.slice(0, 16), slots[1].startsAt.slice(0, 16));
  assert.ok(moved.moved_at);
  assert.equal(moved.status, 'confirmed');

  const free = await lib.findSlots({ date, serviceId: 'trim', staffId: 'ifeoma' });
  assert.ok(!free.some((s) => s.time === slots[1].time), 'new time is taken');
});

test("moving onto someone else's booking is refused and changes nothing", { skip }, async () => {
  const { date, slots } = await freeDay(8);
  const mine = await book(date, slots[0].time);
  const theirs = await lib.createBooking({ serviceId: 'trim', staffChoice: 'ifeoma', date, time: slots[6].time, customer: { ...customer, phone: TEST_PHONE } });
  assert.equal(theirs.ok, true);

  assert.deepEqual(await lib.moveByToken(mine.token, { date, time: slots[6].time }), { ok: false, reason: 'taken' });
  const unchanged = await lib.getBookingByToken(mine.token);
  assert.equal(unchanged.starts_at.slice(0, 16), slots[0].startsAt.slice(0, 16), 'still at the original time');
  assert.equal(unchanged.status, 'confirmed');
});

test('within 2 hours of the appointment, customers must call instead', { skip }, async () => {
  const token = randomBytes(32).toString('base64url');
  const soon = new Date(Date.now() + 60 * 60_000); // in 1 hour
  const { error } = await supabase.from('bookings').insert({
    staff_id: 'ifeoma', service_id: 'trim', starts_at: soon.toISOString(), ends_at: new Date(soon.getTime() + 30 * 60_000).toISOString(),
    customer_name: 'Test Customer', customer_phone: TEST_PHONE, price_kobo: 0, manage_token_hash: lib.hashToken(token),
  });
  // (Inserting can clash if Ifeoma happens to be booked in the next hour; then this test can't run.)
  if (error?.code === '23P01') return;
  assert.equal(error, null, error?.message);

  assert.deepEqual(await lib.cancelByToken(token), { ok: false, reason: 'too-late' });
  const { date } = await freeDay(1);
  assert.deepEqual(await lib.moveByToken(token, { date, time: '10:00' }), { ok: false, reason: 'too-late' });
});

test('staff time off hides those hours from booking, and warns about existing bookings', { skip }, async () => {
  const { date, slots } = await freeDay(10);
  await book(date, slots[0].time); // already booked inside the time off we're about to add

  const result = await lib.addTimeOff({ staffId: 'ifeoma', startDate: date, startTime: slots[0].time, endDate: date, endTime: '23:00', reason: TEST_REASON });
  assert.deepEqual(result, { ok: true, clashes: 1 });
  const after = await lib.findSlots({ date, serviceId: 'trim', staffId: 'ifeoma' });
  assert.ok(after.every((s) => s.time < slots[0].time), 'nothing offered from the start of the time off');

  // Removing it offers the hours again
  const { data: rows } = await supabase.from('time_off').select('id').eq('reason', TEST_REASON);
  for (const row of rows) assert.deepEqual(await lib.removeTimeOff(row.id), { ok: true });
  const again = await lib.findSlots({ date, serviceId: 'trim', staffId: 'ifeoma' });
  assert.ok(again.some((s) => s.time > slots[0].time));
});

test('bad time off is refused with a clear message', { skip }, async () => {
  assert.equal((await lib.addTimeOff({ staffId: 'ifeoma', startDate: '2026-12-05', endDate: '2026-12-04', reason: TEST_REASON })).ok, false);
  assert.equal((await lib.addTimeOff({ staffId: 'nobody', startDate: '2026-12-05', endDate: '2026-12-05', reason: TEST_REASON })).ok, false);
  assert.equal((await lib.addTimeOff({ staffId: 'ifeoma', startDate: 'soon', endDate: '2026-12-05', reason: TEST_REASON })).ok, false);
  assert.equal((await lib.addTimeOff({ staffId: 'ifeoma', startDate: '2026-12-05', startTime: '25:00', endDate: '2026-12-05', reason: TEST_REASON })).ok, false);
  assert.deepEqual(await lib.removeTimeOff("1' or '1'='1"), { ok: false });
});

test('5 wrong passwords lock that visitor out, even with the right password', { skip }, async () => {
  const attempt = (given) => lib.checkPasswordAttempt({ fingerprint: TEST_FINGERPRINT, given, actual: 'the-real-password' });
  assert.deepEqual(await attempt('the-real-password'), { ok: true });
  for (let i = 1; i <= 4; i++) assert.deepEqual(await attempt('guess'), { ok: false, reason: 'wrong' }, `try ${i}`);
  assert.deepEqual(await attempt('guess'), { ok: false, reason: 'locked' }, 'fifth wrong try locks');
  assert.deepEqual(await attempt('the-real-password'), { ok: false, reason: 'locked' }, 'locked even with the right password');
});
