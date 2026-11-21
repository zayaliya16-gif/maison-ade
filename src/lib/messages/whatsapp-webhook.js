import { createHmac, timingSafeEqual } from 'node:crypto';
import { explainWhatsAppError } from './providers.js';

// Reading what Meta tells us after a WhatsApp is sent: delivered, read, or failed (and why). Pure, so tested.

/**
 * Meta signs every webhook with our app secret. This proves a request really came from Meta.
 * @param {string} rawBody     the exact text Meta sent
 * @param {string} signature   the X-Hub-Signature-256 header ("sha256=...")
 * @param {string} appSecret   WHATSAPP_APP_SECRET (Meta app > Settings > Basic > App secret)
 */
export function signatureValid(rawBody, signature, appSecret) {
  if (!appSecret || typeof signature !== 'string' || !signature.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`);
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Turns Meta's webhook body into simple updates for our message log.
 * @returns {Array<{ providerId: string, delivery: 'delivered'|'read'|'failed', at: string, error?: string }>}
 */
export function parseStatuses(body) {
  const updates = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const s of change?.value?.statuses ?? []) {
        if (!s?.id || !['delivered', 'read', 'failed'].includes(s.status)) continue; // "sent" we already know
        const at = Number.isFinite(Number(s.timestamp)) ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString();
        const update = { providerId: String(s.id).slice(0, 200), delivery: s.status, at };
        if (s.status === 'failed') {
          const e = s.errors?.[0];
          update.error = explainWhatsAppError(e?.code, e?.error_data?.details || e?.title || e?.message);
        }
        updates.push(update);
      }
    }
  }
  return updates;
}
