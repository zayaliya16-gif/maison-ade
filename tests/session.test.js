// Tests for the staff login cookie and password check (no database needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordMatches, sessionKey, signSession, verifySession } from '../src/lib/session.js';

const key = sessionKey('server-secret', 'correct horse battery');
const NOW = Date.UTC(2026, 11, 1);
const HOUR = 3_600_000;

test('a fresh cookie is accepted', () => {
  assert.equal(verifySession(signSession(NOW + 12 * HOUR, key), key, NOW), true);
});

test('an expired cookie is refused', () => {
  assert.equal(verifySession(signSession(NOW - 1, key), key, NOW), false);
});

test('editing the expiry (to stay logged in longer) breaks the signature', () => {
  const [, signature] = signSession(NOW + HOUR, key).split('.');
  assert.equal(verifySession(`${NOW + 365 * 24 * HOUR}.${signature}`, key, NOW), false);
});

test('a cookie made with a different key is refused', () => {
  const otherKey = sessionKey('some-other-secret', 'correct horse battery');
  assert.equal(verifySession(signSession(NOW + HOUR, otherKey), key, NOW), false);
});

test('changing the staff password logs everyone out', () => {
  const newKey = sessionKey('server-secret', 'a brand new password');
  assert.equal(verifySession(signSession(NOW + HOUR, key), newKey, NOW), false);
});

test('junk cookies are refused, not crashed on', () => {
  for (const junk of [undefined, null, '', 'abc', '123.456', `${NOW}.`, `.${'a'.repeat(43)}`, `${NOW + HOUR}.${'a'.repeat(43)}`, `${NOW + HOUR}.${'a'.repeat(44)}`]) {
    assert.equal(verifySession(junk, key, NOW), false, String(junk));
  }
});

test('password check: exact match only', () => {
  assert.equal(passwordMatches('correct horse battery', 'correct horse battery'), true);
  for (const wrong of ['Correct horse battery', 'correct horse battery ', '', 'correct', undefined, null]) {
    assert.equal(passwordMatches(wrong, 'correct horse battery'), false, String(wrong));
  }
});
