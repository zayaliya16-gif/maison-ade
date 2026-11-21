// Tests for what messages say, and how service errors are explained (no database, nothing sent).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeMessage, escapeHtml, WHATSAPP_TEMPLATES } from '../src/lib/messages/templates.js';
import { explainResendError, explainWhatsAppError, isRetryableWhatsApp } from '../src/lib/messages/providers.js';

const booking = {
  customer_name: 'Ada Okafor',
  starts_at: '2026-12-05T09:30:00Z', // 10:30 am in Lagos
  price_kobo: 3500000,
  service: { name: 'Silk press', minutes: 90 },
  stylist: { name: 'Tolu' },
};
const urls = { link: 'https://maison-ade.vercel.app/b/abc', bookLink: 'https://maison-ade.vercel.app/book' };

test('confirmation has every detail, in Lagos time, with the private link', () => {
  const m = composeMessage('confirmed', booking, urls);
  assert.match(m.subject, /Booked: Silk press, Saturday 5 December 2026, 10:30 am/);
  for (const part of ['Hi Ada', 'Silk press with Tolu (1 hr 30 mins)', '₦35,000', 'https://maison-ade.vercel.app/b/abc']) {
    assert.ok(m.text.includes(part), part);
    assert.ok(m.whatsappText.includes(part), `WhatsApp: ${part}`);
  }
  assert.ok(m.html.includes('href="https://maison-ade.vercel.app/b/abc"'));
});

test('cancellation offers "book again" instead of the private link', () => {
  const m = composeMessage('cancelled', booking, urls);
  assert.match(m.subject, /^Cancelled/);
  assert.ok(m.text.includes('Book again: https://maison-ade.vercel.app/book'));
  assert.ok(!m.text.includes('/b/abc'));
});

test('without a private link, customers are told to call', () => {
  const m = composeMessage('moved', booking, { ...urls, link: null });
  assert.match(m.text, /call us on/);
  assert.ok(!m.html.includes('/b/'));
});

test('every kind has wording and a WhatsApp template', () => {
  for (const kind of ['confirmed', 'moved', 'cancelled', 'reminder_day', 'reminder_soon']) {
    const m = composeMessage(kind, booking, urls);
    assert.ok(m.subject && m.text && m.html && m.whatsappText, kind);
    for (const p of WHATSAPP_TEMPLATES[kind].params) assert.ok(m.values[p], `${kind} template value ${p}`);
  }
  assert.throws(() => composeMessage('party', booking, urls), /Unknown message kind/);
});

test('customer names can never inject HTML into emails', () => {
  const m = composeMessage('confirmed', { ...booking, customer_name: '<script>alert(1)</script> Okafor' }, urls);
  assert.ok(!m.html.includes('<script>'));
  assert.ok(m.html.includes('&lt;script&gt;'));
  assert.equal(escapeHtml(`"a" & 'b'`), '&quot;a&quot; &amp; &#39;b&#39;');
});

test('service errors are explained in plain words, and only temporary ones are retried', () => {
  assert.match(explainWhatsAppError(131047), /24 hours/);
  assert.match(explainWhatsAppError(131030), /allowed list/);
  assert.match(explainWhatsAppError(190), /token/);
  assert.match(explainWhatsAppError(999999, 'odd'), /WhatsApp error 999999: odd/);
  assert.match(explainResendError(403, 'You can only send testing emails to your own email address'), /own Resend email/);
  assert.equal(isRetryableWhatsApp(500), true);
  assert.equal(isRetryableWhatsApp(429), true);
  assert.equal(isRetryableWhatsApp(400, 131030), false); // wrong number: retrying won't help
  assert.equal(isRetryableWhatsApp(400, 190), false);
});
