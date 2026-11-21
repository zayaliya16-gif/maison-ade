import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// The maths behind the staff login cookie. Pure (no database, no cookies), so it's fully tested.
//
// The cookie looks like "1767225600000.Xy3k...": an expiry time plus a signature.
// The signature is made with a key only our server knows, so nobody can make or edit a cookie
// (for example, push the expiry date forward) without the server noticing.

/**
 * The signing key. It mixes in the staff password, so changing the password logs everyone out.
 * @param {string} serverSecret  a long secret only the server has (we reuse SUPABASE_SECRET_KEY)
 * @param {string} password      the current STAFF_PASSWORD
 */
export function sessionKey(serverSecret, password) {
  return createHash('sha256').update(`maison-ade staff session\n${serverSecret}\n${password}`).digest();
}

/** A cookie value that's valid until `expiresAtMs` */
export function signSession(expiresAtMs, key) {
  const body = String(Math.floor(expiresAtMs));
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}

/** True only for an untampered cookie that hasn't expired */
export function verifySession(value, key, nowMs = Date.now()) {
  const match = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(String(value ?? ''));
  if (!match) return false;
  const expected = Buffer.from(createHmac('sha256', key).update(match[1]).digest('base64url'));
  const given = Buffer.from(match[2]);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  return Number(match[1]) > nowMs;
}

/**
 * Compares passwords in constant time, so how long the check takes gives no hint about how close a guess was.
 * (Both are hashed first so they're always the same length.)
 */
export function passwordMatches(given, actual) {
  const a = createHash('sha256').update(String(given ?? '')).digest();
  const b = createHash('sha256').update(String(actual ?? '')).digest();
  return timingSafeEqual(a, b);
}
