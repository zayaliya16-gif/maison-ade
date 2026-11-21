import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';

/**
 * A scrambled fingerprint of where a request comes from, for rate limits. We never store the address itself,
 * and the fingerprint can't be turned back into it (it's mixed with a server secret).
 * `purpose` keeps fingerprints for different things (login, booking) unrelated to each other.
 */
export async function visitorFingerprint(purpose) {
  const h = await headers();
  // On Vercel, x-forwarded-for is set by Vercel itself, so visitors can't fake it
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(`maison-ade ${purpose}\n${process.env.SUPABASE_SECRET_KEY}\n${ip}`).digest('hex');
}
