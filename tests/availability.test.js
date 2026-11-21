// Tests for the availability engine, using made-up schedules (no database needed).
// Dates used: Sat 5 Dec 2026 (salon 9:00-19:00), Sun 6 Dec (12:00-17:00), Mon 7 Dec (closed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableSlots, lagosTime, lagosToday, parseDate, toMinutes, weekdayOf } from '../src/lib/availability.js';
import { salon, services, staff, bookingRules, demoDaysOff } from '../src/config/salon.js';

const SAT = '2026-12-05';
const SUN = '2026-12-06';
const MON = '2026-12-07';
const NOW = new Date('2026-12-01T00:00:00Z'); // a few days before, so notice rules don't get in the way

// Lagos wall-clock time → ISO string, for writing bookings in tests
const at = (date, hhmm) => lagosTime(date, toMinutes(hhmm)).toISOString();

function slots(overrides = {}) {
  return getAvailableSlots({
    date: SAT,
    serviceMinutes: 60,
    staffIds: ['tolu'],
    salonHours: salon.hours,
    workingHours: [0, 2, 3, 4, 5, 6].flatMap((weekday) => [
      { staffId: 'tolu', weekday, starts: '00:00', ends: '23:59' },
      { staffId: 'kemi', weekday, starts: '00:00', ends: '23:59' },
    ]),
    busy: [],
    rules: bookingRules,
    now: NOW,
    ...overrides,
  });
}
const times = (list) => list.map((s) => s.time);

test('Lagos time: 9:00 in Lagos is 8:00 UTC', () => {
  assert.equal(at(SAT, '09:00'), '2026-12-05T08:00:00.000Z');
  assert.equal(weekdayOf(SAT), 6);
  assert.equal(lagosToday(new Date('2026-12-05T23:30:00Z')), '2026-12-06'); // 00:30 next day in Lagos
});

test('a normal Saturday: 60-minute slots every 15 minutes from 9:00, last one 18:00', () => {
  const list = slots();
  assert.equal(list[0].time, '09:00');
  assert.equal(list.at(-1).time, '18:00');
  assert.equal(list.length, 37);
  assert.equal(list[0].startsAt, '2026-12-05T08:00:00.000Z');
  assert.equal(list[0].endsAt, '2026-12-05T09:00:00.000Z');
});

test('salon closed on Monday: no slots', () => {
  assert.deepEqual(slots({ date: MON }), []);
});

test('Sunday uses the shorter Sunday hours (12:00-17:00)', () => {
  const list = slots({ date: SUN });
  assert.equal(list[0].time, '12:00');
  assert.equal(list.at(-1).time, '16:00');
});

test('a 5-hour service must finish by closing: last start 14:00', () => {
  assert.equal(slots({ serviceMinutes: 300 }).at(-1).time, '14:00');
});

test('a service longer than the day has no slots', () => {
  assert.deepEqual(slots({ date: SUN, serviceMinutes: 330 }), []);
});

test('a booking blocks overlapping starts, but touching ones are fine', () => {
  const list = times(slots({ busy: [{ staffId: 'tolu', startsAt: at(SAT, '10:00'), endsAt: at(SAT, '11:00') }] }));
  assert.ok(list.includes('09:00'), '9:00-10:00 ends exactly when the booking starts');
  for (const t of ['09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45']) assert.ok(!list.includes(t), `${t} clashes`);
  assert.ok(list.includes('11:00'), '11:00 starts exactly when the booking ends');
});

test("someone else's booking doesn't block this stylist", () => {
  const list = slots({ busy: [{ staffId: 'kemi', startsAt: at(SAT, '10:00'), endsAt: at(SAT, '11:00') }] });
  assert.ok(times(list).includes('10:00'));
});

test('time off removes those hours', () => {
  const list = times(slots({ busy: [{ staffId: 'tolu', startsAt: at(SAT, '09:00'), endsAt: at(SAT, '13:00') }] }));
  assert.equal(list[0], '13:00');
});

test('time off covering the whole day (or several days) leaves nothing', () => {
  const busy = [{ staffId: 'tolu', startsAt: '2026-12-04T00:00:00Z', endsAt: '2026-12-08T00:00:00Z' }];
  assert.deepEqual(slots({ busy }), []);
});

test("the stylist's day off: no working-hours row means no slots", () => {
  assert.deepEqual(slots({ workingHours: [] }), []);
});

test('stylist hours narrower than the salon: only the overlap counts', () => {
  const list = slots({ workingHours: [{ staffId: 'tolu', weekday: 6, starts: '10:00:00', ends: '14:00:00' }] });
  assert.equal(list[0].time, '10:00');
  assert.equal(list.at(-1).time, '13:00');
});

test('odd shift start times are lined up to the 15-minute grid', () => {
  const list = slots({ workingHours: [{ staffId: 'tolu', weekday: 6, starts: '10:05', ends: '12:00' }] });
  assert.equal(list[0].time, '10:15');
});

test('"any stylist" combines everyone, and lists who is free at each time', () => {
  const list = slots({
    staffIds: ['tolu', 'kemi'],
    busy: [{ staffId: 'tolu', startsAt: at(SAT, '10:00'), endsAt: at(SAT, '11:00') }],
  });
  assert.deepEqual(list.find((s) => s.time === '09:00').staffIds, ['tolu', 'kemi']);
  assert.deepEqual(list.find((s) => s.time === '10:00').staffIds, ['kemi']);
});

test('minimum notice: at 9:00 on the day, the first slot is 11:00', () => {
  const list = slots({ now: new Date(at(SAT, '09:00')) });
  assert.equal(list[0].time, '11:00');
});

test('slots already in the past are never offered', () => {
  assert.deepEqual(slots({ now: new Date(at(SAT, '20:00')) }), []);
});

test('too far ahead: nothing more than 60 days out', () => {
  assert.deepEqual(slots({ now: new Date('2026-09-01T00:00:00Z') }), []);
});

test('bad dates are rejected, not guessed', () => {
  assert.throws(() => parseDate('2026-02-30'), /no such day/);
  assert.throws(() => parseDate('05/12/2026'), /YYYY-MM-DD/);
  assert.throws(() => slots({ date: '' }), /Invalid date/);
  assert.throws(() => toMinutes('9am'), /Invalid time/);
  assert.throws(() => slots({ serviceMinutes: 0 }), /positive/);
});

test('salon.js data is consistent with the database rules', () => {
  const serviceIds = new Set(services.map((s) => s.id));
  for (const s of services) {
    assert.ok(s.minutes % 15 === 0 && s.minutes > 0, `${s.id} minutes must be a multiple of 15`);
    assert.ok(Number.isInteger(s.priceKobo) && s.priceKobo >= 0, `${s.id} price`);
  }
  for (const person of staff) {
    for (const id of person.services) assert.ok(serviceIds.has(id), `${person.id} offers unknown service ${id}`);
  }
  for (const id of Object.keys(demoDaysOff)) assert.ok(staff.some((p) => p.id === id), `unknown stylist ${id}`);
});
