// Tests for checking what customers type (no database needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanEmail, cleanName, normalizePhone, parseCustomer, rankStylists } from '../src/lib/booking-input.js';
import { addDays, toLagos } from '../src/lib/availability.js';
import { longDate, shortDate } from '../src/lib/format.js';

test('Nigerian numbers written any common way become +234...', () => {
  for (const raw of ['08031234567', '0803 123 4567', '0803-123-4567', '2348031234567', '+2348031234567', '+234 803 123 4567', '+234 (0) 803 123 4567', ' 0803 123 4567 ']) {
    assert.equal(normalizePhone(raw), '+2348031234567', raw);
  }
  assert.equal(normalizePhone('07061234567'), '+2347061234567');
  assert.equal(normalizePhone('09121234567'), '+2349121234567');
});

test('international numbers need a +', () => {
  assert.equal(normalizePhone('+44 7700 900123'), '+447700900123');
  assert.equal(normalizePhone('+1 (202) 555-0143'), '+12025550143');
  assert.equal(normalizePhone('447700900123'), null);
});

test('things that are not mobile numbers are refused', () => {
  for (const raw of ['', '   ', 'hello', '0803123456', '080312345678', '01 234 5678', '+234 1 234 5678', '+0 123 456 789', '+1234567', '0803 123 4567 ext 2', '+'.padEnd(40, '1'), null, undefined]) {
    assert.equal(normalizePhone(raw), null, String(raw));
  }
});

test('names are tidied, and junk is refused', () => {
  assert.equal(cleanName('  Ada   Okafor '), 'Ada Okafor');
  assert.equal(cleanName('Ọlá Adébáyọ̀'), 'Ọlá Adébáyọ̀'.normalize('NFC'));
  assert.equal(cleanName("O'Neil-Bello"), "O'Neil-Bello");
  for (const bad of ['', 'A', '   ', '12345', '<script>', 'a'.repeat(101), 'Ada\u0000Okafor']) assert.equal(cleanName(bad), null, bad);
});

test('email is optional, but must look like an email if given', () => {
  assert.equal(cleanEmail(''), '');
  assert.equal(cleanEmail(' Ada@Example.COM '), 'ada@example.com');
  for (const bad of ['ada', 'ada@', '@x.com', 'ada@x', 'a b@x.com', `${'a'.repeat(250)}@x.com`]) assert.equal(cleanEmail(bad), null, bad);
});

test('the whole form: good details pass and are cleaned', () => {
  const result = parseCustomer({ name: ' Ada  Okafor', phone: '0803 123 4567', email: '', whatsapp: 'on' });
  assert.deepEqual(result, { ok: true, customer: { name: 'Ada Okafor', phone: '+2348031234567', email: null, whatsappOptIn: true, emailOptIn: false } });
});

test('the whole form: every problem is reported, in plain words', () => {
  const result = parseCustomer({ name: '', phone: '123', email: 'nope' });
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['email', 'name', 'phone']);
});

test('email reminders need an email address', () => {
  const result = parseCustomer({ name: 'Ada', phone: '08031234567', email: '', emailReminders: 'on' });
  assert.match(result.errors.email, /Add your email/);
});

test('"any stylist" goes to whoever is least busy; ties keep the salon order', () => {
  assert.deepEqual(rankStylists(['tolu', 'kemi'], new Map([['tolu', 3], ['kemi', 1]])), ['kemi', 'tolu']);
  assert.deepEqual(rankStylists(['tolu', 'kemi'], new Map()), ['tolu', 'kemi']);
  assert.deepEqual(rankStylists(['tolu', 'kemi', 'ifeoma'], new Map([['tolu', 2], ['kemi', 2], ['ifeoma', 2]])), ['tolu', 'kemi', 'ifeoma']);
});

test('date helpers', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addDays('2026-12-05', -7), '2026-11-28');
  assert.deepEqual(toLagos('2026-12-05T23:30:00Z'), { date: '2026-12-06', time: '00:30' });
  assert.equal(shortDate('2026-12-05'), 'Sat 5 Dec');
  assert.equal(longDate('2026-12-05'), 'Saturday 5 December 2026');
});
