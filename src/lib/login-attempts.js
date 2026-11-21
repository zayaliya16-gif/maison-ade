import 'server-only';
import { db } from './supabase.js';
import { passwordMatches } from './session.js';

// Slowing down password guessing: 5 wrong tries from one place = a 15-minute pause.
// Kept apart from cookies (next/headers) so tests can run it directly.

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
// Across ALL visitors: stops someone guessing from many different addresses at once.
// (The cost: during such an attack, staff also have to wait.)
export const MAX_FAILED_LOGINS_EVERYONE = 30;

/**
 * Checks a password attempt against the lockout rule and records it. Separate from cookies so tests can use it.
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'wrong' | 'locked' }>}
 */
export async function checkPasswordAttempt({ fingerprint, given, actual, now = new Date() }) {
  const supabase = db();
  const since = new Date(now.getTime() - LOCK_MINUTES * 60_000).toISOString();
  const { count, error } = await supabase.from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', fingerprint).eq('succeeded', false).gte('attempted_at', since);
  if (error) throw error;
  if (count >= MAX_FAILED_LOGINS) return { ok: false, reason: 'locked' }; // don't even check the password

  const { count: everyone, error: everyoneError } = await supabase.from('login_attempts')
    .select('id', { count: 'exact', head: true }).eq('succeeded', false).gte('attempted_at', since);
  if (everyoneError) throw everyoneError;
  if (everyone >= MAX_FAILED_LOGINS_EVERYONE) return { ok: false, reason: 'locked' };

  const ok = passwordMatches(given, actual);
  const { error: insertError } = await supabase.from('login_attempts').insert({ ip_hash: fingerprint, succeeded: ok });
  if (insertError) throw insertError;
  // Tidy up: attempts older than a day are no longer needed
  await supabase.from('login_attempts').delete().lt('attempted_at', new Date(now.getTime() - 86_400_000).toISOString());

  if (ok) return { ok: true };
  return { ok: false, reason: count + 1 >= MAX_FAILED_LOGINS ? 'locked' : 'wrong' };
}

