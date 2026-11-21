// Sends ONE real test message, to check your WhatsApp and email keys work.
// Run:  npm run msg:test -- 08031234567            (WhatsApp to your number)
//       npm run msg:test -- you@example.com        (email to your address)
//       npm run msg:test -- 08031234567 you@example.com
//       npm run msg:test -- hello 08031234567          (Meta's built-in hello_world template: works without the 24-hour window)
// Uses the same senders and wording as the app. Nothing is saved to the database.
import { sendEmail, sendWhatsApp } from '../src/lib/messages/providers.js';
import { composeMessage, WHATSAPP_TEMPLATES } from '../src/lib/messages/templates.js';
import { normalizePhone, cleanEmail } from '../src/lib/booking-input.js';
import { randomUUID } from 'node:crypto';

const all = process.argv.slice(2);
const hello = all.includes('hello');
const args = all.filter((a) => a !== 'hello');
if (args.length === 0) {
  console.log('Usage: npm run msg:test -- <your WhatsApp number> <your email>   (either or both)');
  process.exit(1);
}

const demo = {
  customer_name: 'Test Customer',
  starts_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  price_kobo: 3500000,
  service: { name: 'Silk press', minutes: 90 },
  stylist: { name: 'Tolu' },
};
const content = composeMessage('confirmed', demo, { link: 'https://maison-ade.vercel.app/book', bookLink: 'https://maison-ade.vercel.app/book' });
content.subject = `[TEST] ${content.subject}`;

for (const arg of args) {
  if (arg.includes('@')) {
    const to = cleanEmail(arg);
    if (!to) { console.log(`✗ "${arg}" doesn't look like an email`); continue; }
    const r = await sendEmail({ to, subject: content.subject, text: content.text, html: content.html, messageId: randomUUID() });
    console.log(r.ok ? `✓ Email accepted by Resend (id ${r.id}). Check your inbox (and spam).` : `✗ Email: ${r.error}`);
  } else {
    const to = normalizePhone(arg);
    if (!to) { console.log(`✗ "${arg}" doesn't look like a mobile number`); continue; }
    if (hello) process.env.WHATSAPP_USE_TEMPLATES = 'on', process.env.WHATSAPP_TEMPLATE_LANGUAGE = 'en_US';
    const r = await sendWhatsApp({
      to,
      text: `[TEST] ${content.whatsappText}`,
      template: hello ? { name: 'hello_world', params: [] } : WHATSAPP_TEMPLATES.confirmed,
      values: content.values,
    });
    console.log(r.ok ? '✓ WhatsApp accepted by Meta. Check your phone.' : `✗ WhatsApp: ${r.error}`);
  }
}
