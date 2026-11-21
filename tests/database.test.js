// Tests against the real Supabase database: does it refuse double bookings by itself?
// Needs .env.local (skipped otherwise). Uses dates in 2099 and deletes its own test rows afterwards.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const skip = !SUPABASE_URL || !SUPABASE_SECRET_KEY ? 'no Supabase details in .env.local' : false;
const supabase = skip ? null : createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const TAG = `test-${randomUUID()}`; // every row this run creates is marked with this

function book(staffId, starts, ends, status = 'confirmed') {
  return supabase.from('bookings').insert({
    staff_id: staffId,
    service_id: 'trim',
    starts_at: starts,
    ends_at: ends,
    status,
    customer_name: 'Test Customer',
    customer_phone: '+2348000000000',
    price_kobo: 0,
    manage_token_hash: `${TAG}-${randomUUID()}`,
  });
}

before(async () => {
  if (skip) return;
  const { error } = await supabase.from('bookings').select('id').limit(1);
  if (error) throw new Error(`The bookings table isn't ready (${error.message}). Run supabase/migrations/0001_availability.sql, then npm run db:seed.`);
});

after(async () => {
  if (!skip) await supabase.from('bookings').delete().like('manage_token_hash', `${TAG}-%`);
});

test('the database refuses overlapping bookings for the same stylist', { skip }, async () => {
  const first = await book('tolu', '2099-01-03T09:00:00Z', '2099-01-03T10:00:00Z');
  assert.equal(first.error, null, first.error?.message);

  const clash = await book('tolu', '2099-01-03T09:30:00Z', '2099-01-03T10:30:00Z');
  assert.equal(clash.error?.code, '23P01', 'expected the no_double_booking rule to refuse it'); // 23P01 = exclusion violation

  const touching = await book('tolu', '2099-01-03T10:00:00Z', '2099-01-03T11:00:00Z');
  assert.equal(touching.error, null, 'a booking starting exactly when the last one ends is fine');

  const otherStylist = await book('kemi', '2099-01-03T09:30:00Z', '2099-01-03T10:30:00Z');
  assert.equal(otherStylist.error, null, 'a different stylist at the same time is fine');

  const cancelled = await book('tolu', '2099-01-03T09:30:00Z', '2099-01-03T10:30:00Z', 'cancelled');
  assert.equal(cancelled.error, null, 'cancelled bookings never block anything');
});

test('the database refuses bad booking data', { skip }, async () => {
  const backwards = await book('tolu', '2099-01-04T10:00:00Z', '2099-01-04T09:00:00Z');
  assert.equal(backwards.error?.code, '23514', 'end before start must be refused'); // 23514 = check rule broken

  const badPhone = await supabase.from('bookings').insert({
    staff_id: 'tolu', service_id: 'trim', starts_at: '2099-01-05T09:00:00Z', ends_at: '2099-01-05T10:00:00Z',
    customer_name: 'Test', customer_phone: '0800 not a number', price_kobo: 0, manage_token_hash: `${TAG}-${randomUUID()}`,
  });
  assert.equal(badPhone.error?.code, '23514', 'phone numbers must be in +234... format');
});
