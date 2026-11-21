// Can an attacker with Supabase's PUBLIC key read or change anything? They shouldn't: the public roles have no
// permissions at all (revoked), and Row Level Security is on as a second lock.
// Needs SUPABASE_PUBLISHABLE_KEY in .env.local (Supabase > Project Settings > API Keys > Publishable key).
// That key is public by design (it's meant for browsers), so it's safe to store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
const skip = !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY ? 'add SUPABASE_PUBLISHABLE_KEY to .env.local to run' : false;
const attacker = skip ? null : createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

const TABLES = ['services', 'staff', 'staff_services', 'working_hours', 'time_off', 'bookings', 'login_attempts', 'messages'];
const DENIED = '42501'; // Postgres: "permission denied"

test('the public key is refused on every table (reading)', { skip }, async () => {
  for (const table of TABLES) {
    const { error } = await attacker.from(table).select('*').limit(1);
    assert.equal(error?.code, DENIED, `${table}: expected "permission denied", got ${error ? error.message : 'data!'}`);
  }
});

test('the public key is refused on every table (writing and deleting)', { skip }, async () => {
  const insert = await attacker.from('bookings').insert({
    staff_id: 'tolu', service_id: 'trim', starts_at: '2099-01-01T09:00:00Z', ends_at: '2099-01-01T09:30:00Z',
    customer_name: 'Attacker', customer_phone: '+99900000099', price_kobo: 0, manage_token_hash: 'x'.repeat(64),
  });
  assert.equal(insert.error?.code, DENIED, 'inserting a booking');

  const update = await attacker.from('bookings').update({ status: 'cancelled' }).eq('status', 'confirmed');
  assert.equal(update.error?.code, DENIED, 'cancelling bookings');

  const del = await attacker.from('messages').delete().eq('status', 'sent');
  assert.equal(del.error?.code, DENIED, 'deleting messages');
});
