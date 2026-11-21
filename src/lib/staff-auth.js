import 'server-only';
import { createHash } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionKey, signSession, verifySession } from './session.js';
import { checkPasswordAttempt } from './login-attempts.js';

export { LOCK_MINUTES } from './login-attempts.js';

// Staff login: one shared salon password (STAFF_PASSWORD), a signed cookie for 12 hours,
// and a 15-minute pause after 5 wrong passwords from the same place.

const COOKIE = 'staff_session';
const SESSION_HOURS = 12;
export const MIN_PASSWORD_LENGTH = 12;

/** The password and signing key, or null if STAFF_PASSWORD isn't set up (then nobody can log in) */
function settings() {
  const password = process.env.STAFF_PASSWORD;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!password || password.length < MIN_PASSWORD_LENGTH || !secret) return null;
  return { password, key: sessionKey(secret, password) };
}

/** Is the person looking at this page logged in as staff? */
export async function isStaff() {
  const s = settings();
  if (!s) return false;
  return verifySession((await cookies()).get(COOKIE)?.value, s.key);
}

/** Use at the top of every staff page and staff action: sends anyone not logged in to the login page */
export async function requireStaff() {
  if (!(await isStaff())) redirect('/staff/login');
}

/** A scrambled fingerprint of where a request comes from (we never store the address itself) */
async function visitorFingerprint() {
  const h = await headers();
  // On Vercel, x-forwarded-for is set by Vercel itself, so visitors can't fake it
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(`maison-ade login\n${process.env.SUPABASE_SECRET_KEY}\n${ip}`).digest('hex');
}

/** @returns {Promise<{ ok: true } | { ok: false, reason: 'not-set-up' | 'wrong' | 'locked' }>} */
export async function logIn(given) {
  const s = settings();
  if (!s) return { ok: false, reason: 'not-set-up' };
  const result = await checkPasswordAttempt({ fingerprint: await visitorFingerprint(), given, actual: s.password });
  if (!result.ok) return result;

  (await cookies()).set(COOKIE, signSession(Date.now() + SESSION_HOURS * 3_600_000, s.key), {
    httpOnly: true, // page scripts can't read it
    secure: process.env.NODE_ENV === 'production', // only sent over https on the live site
    sameSite: 'strict', // never sent when another site links or posts here
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  });
  return { ok: true };
}

export async function logOut() {
  (await cookies()).delete(COOKIE);
}
