import { db } from '@/lib/supabase.js';

// Health check: is the live server set up and can it reach the database?
// Reports only yes/no and the KIND of key, never the key or any customer data.
export const dynamic = 'force-dynamic';

function keyKind(key) {
  if (!key) return 'missing';
  if (key !== key.trim()) return 'has spaces at the start or end';
  if (/^["']/.test(key)) return 'wrapped in quote marks';
  if (key.startsWith('sb_secret_')) return 'secret key (correct)';
  if (key.startsWith('sb_publishable_')) return 'publishable key (WRONG: use the secret key)';
  if (key.startsWith('eyJ')) return 'legacy JWT key (must be service_role, not anon)';
  return 'unrecognised';
}

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const report = {
    SUPABASE_URL: !url ? 'missing' : /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url) ? 'looks right' : 'set, but not in the form https://xxxx.supabase.co',
    SUPABASE_SECRET_KEY: keyKind(process.env.SUPABASE_SECRET_KEY),
    database: 'not tried',
    // Names only (never values), to spot typos like "SUPABASE_URL " or "supabase_url"
    similarNames: Object.keys(process.env).filter((name) => /supa|secret/i.test(name)).map((name) => JSON.stringify(name)),
  };
  try {
    const { error } = await db().from('services').select('id', { head: true, count: 'exact' });
    report.database = error ? `error: ${error.message}` : 'ok';
  } catch (error) {
    report.database = `error: ${error.message}`;
  }
  const ok = report.database === 'ok';
  return Response.json({ ok, ...report }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
