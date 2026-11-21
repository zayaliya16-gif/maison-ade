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
    STAFF_PASSWORD: !process.env.STAFF_PASSWORD ? 'missing' : process.env.STAFF_PASSWORD.length < 12 ? 'too short (needs 12+ characters)' : 'set',
    RESEND_API_KEY: process.env.RESEND_API_KEY ? 'set' : 'missing (emails are logged as not sent)',
    WHATSAPP: process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID ? 'set' : 'missing (WhatsApps are logged as not sent)',
    CRON_SECRET: (process.env.CRON_SECRET ?? '').length >= 32 ? 'set' : 'missing (automatic reminders are off)',
    WHATSAPP_WEBHOOK: process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? 'set' : 'missing (no delivered/read tracking)',
    database: 'not tried',
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
