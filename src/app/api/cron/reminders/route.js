import { passwordMatches } from '@/lib/session.js';
import { runReminders } from '@/lib/reminders.js';

// Called every 15 minutes by Supabase (pg_cron). Only works with the secret CRON_SECRET,
// so nobody else can trigger mass sending.

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds

async function handle(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return Response.json({ ok: false, error: 'CRON_SECRET is not set up' }, { status: 503 });

  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!passwordMatches(given, secret)) return Response.json({ ok: false }, { status: 401 });

  try {
    const summary = await runReminders();
    console.log('Reminder run', summary);
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    console.error('Reminder run failed', error);
    return Response.json({ ok: false, error: 'Reminder run failed (see Vercel logs)' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
