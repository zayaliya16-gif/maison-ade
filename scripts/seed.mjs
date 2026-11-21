// Copies services, stylists and who-does-what from src/config/salon.js into the database.
// Safe to run again: it updates whatever changed. Stylists' working hours are only filled in
// the first time, so hours changed later (phase 4 staff calendar) are never overwritten.
// Run: npm run db:seed
import { createClient } from '@supabase/supabase-js';
import { salon, services, staff, demoDaysOff } from '../src/config/salon.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

async function step(label, query) {
  const { error } = await query;
  if (error) {
    console.error(`✗ ${label}: ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ ${label}`);
}

await step('services', supabase.from('services').upsert(
  services.map((s) => ({ id: s.id, name: s.name, minutes: s.minutes, price_kobo: s.priceKobo, active: true })),
));
await step('stylists', supabase.from('staff').upsert(staff.map((p) => ({ id: p.id, name: p.name, active: true }))));

// Anything no longer in salon.js is switched off, not deleted, so old bookings still make sense
await step('switch off removed services', supabase.from('services').update({ active: false })
  .not('id', 'in', `(${services.map((s) => s.id).join(',')})`));
await step('switch off removed stylists', supabase.from('staff').update({ active: false })
  .not('id', 'in', `(${staff.map((p) => p.id).join(',')})`));

// Who does what: replace each stylist's list with the one in salon.js
for (const person of staff) {
  await step(`${person.name}: clear services`, supabase.from('staff_services').delete().eq('staff_id', person.id));
  await step(`${person.name}: ${person.services.length} services`, supabase.from('staff_services')
    .insert(person.services.map((id) => ({ staff_id: person.id, service_id: id }))));
}

// Working hours: the salon's hours on every open day except their day off. Existing rows are left alone.
const hours = [];
for (const person of staff) {
  for (const [weekday, day] of Object.entries(salon.hours)) {
    if (day && !(demoDaysOff[person.id] ?? []).includes(Number(weekday))) {
      hours.push({ staff_id: person.id, weekday: Number(weekday), starts: day.open, ends: day.close });
    }
  }
}
await step('working hours (first time only)', supabase.from('working_hours').upsert(hours, { ignoreDuplicates: true }));
console.log('Done.');
