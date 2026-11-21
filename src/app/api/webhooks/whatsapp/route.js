import { db } from '@/lib/supabase.js';
import { MAX_ATTEMPTS } from '@/lib/messages/outbox.js';
import { parseStatuses, signatureValid } from '@/lib/messages/whatsapp-webhook.js';
import { passwordMatches } from '@/lib/session.js';

// Meta calls this address when a WhatsApp is delivered, read or fails.
// Set it up in Meta: your app > WhatsApp > Configuration > Webhook (see README).

export const dynamic = 'force-dynamic';

// 1. Meta checks the address once when you save it: it sends our verify token and expects its "challenge" back
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (expected && params.get('hub.mode') === 'subscribe' && passwordMatches(params.get('hub.verify_token'), expected)) {
    return new Response(params.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response('Forbidden', { status: 403 });
}

// 2. Status updates. Only accepted if signed with our app secret.
export async function POST(request) {
  const raw = await request.text();
  if (raw.length > 1_000_000) return new Response('Too large', { status: 413 });
  if (!signatureValid(raw, request.headers.get('x-hub-signature-256'), process.env.WHATSAPP_APP_SECRET)) {
    return new Response('Bad signature', { status: 401 });
  }

  let body;
  try { body = JSON.parse(raw); } catch { return new Response('Bad JSON', { status: 400 }); }

  try {
    const supabase = db();
    for (const u of parseStatuses(body)) {
      // Never move backwards (e.g. a late "delivered" arriving after "read")
      const fields = u.delivery === 'read'
        ? { delivery: 'read', read_at: u.at }
        : u.delivery === 'delivered'
          ? { delivery: 'delivered', delivered_at: u.at }
          : { delivery: 'failed', status: 'failed', attempts: MAX_ATTEMPTS, error: u.error };
      let q = supabase.from('messages').update(fields).eq('channel', 'whatsapp').eq('provider_id', u.providerId);
      if (u.delivery === 'delivered') q = q.or('delivery.is.null,delivery.eq.delivered');
      const { error } = await q;
      if (error) throw error;
    }
  } catch (error) {
    console.error('WhatsApp webhook failed', error);
    return new Response('Error', { status: 500 }); // Meta will try again later
  }
  return new Response('OK', { status: 200 });
}
