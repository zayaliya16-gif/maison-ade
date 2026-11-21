// What each message says. Pure (no sending, no database), so it's easy to test and to tweak the wording.

import { salon } from '../../config/salon.js';
import { toLagos } from '../availability.js';
import { clock, duration, longDate, naira } from '../format.js';

const DEMO_NOTE = 'Maison Adé is a made-up salon for a portfolio project.';

/** Makes text safe to put inside HTML (a customer named "<b>" stays plain text) */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/**
 * WhatsApp templates (for when Meta has approved them; see README). The {{1}}, {{2}}... in each template
 * are filled with these values in this order. Free-form text is used until then.
 */
export const WHATSAPP_TEMPLATES = {
  confirmed: { name: 'maison_booking_confirmed', params: ['firstName', 'service', 'stylist', 'when', 'link'] },
  moved: { name: 'maison_booking_moved', params: ['firstName', 'service', 'stylist', 'when', 'link'] },
  cancelled: { name: 'maison_booking_cancelled', params: ['firstName', 'service', 'when', 'bookLink'] },
  reminder_day: { name: 'maison_booking_reminder', params: ['firstName', 'service', 'stylist', 'when', 'link'] },
  reminder_soon: { name: 'maison_booking_reminder', params: ['firstName', 'service', 'stylist', 'when', 'link'] },
};

/**
 * @param {string} kind  confirmed | moved | cancelled | reminder_day | reminder_soon
 * @param {object} booking  { customer_name, starts_at, price_kobo, service: { name, minutes }, stylist: { name } }
 * @param {{ link: string|null, bookLink: string }} urls  the private link (null if it can't be made) and the booking page
 * @returns {{ subject, text, html, whatsappText, values }}
 */
export function composeMessage(kind, booking, { link, bookLink }) {
  const firstName = booking.customer_name.split(' ')[0];
  const start = toLagos(booking.starts_at);
  const when = `${longDate(start.date)}, ${clock(start.time)}`;
  const service = booking.service.name;
  const stylist = booking.stylist.name;
  const values = { firstName, service, stylist, when, link: link ?? bookLink, bookLink };

  const lines = {
    confirmed: { subject: `Booked: ${service}, ${when}`, intro: `you’re booked at ${salon.name}.` },
    moved: { subject: `New time: ${service}, ${when}`, intro: 'your booking has moved to a new time.' },
    cancelled: { subject: `Cancelled: ${service}, ${when}`, intro: 'your booking is cancelled. We hope to see you another time.' },
    reminder_day: { subject: `Tomorrow: ${service} at ${clock(start.time)}`, intro: 'a reminder that we’ll see you tomorrow.' },
    reminder_soon: { subject: `Soon: ${service} at ${clock(start.time)}`, intro: 'a reminder that we’ll see you in about two hours.' },
  }[kind];
  if (!lines) throw new Error(`Unknown message kind "${kind}"`);

  const cancelled = kind === 'cancelled';
  const details = cancelled
    ? [`${service} with ${stylist}`, when]
    : [`${service} with ${stylist} (${duration(booking.service.minutes)})`, when, `${naira(booking.price_kobo)}, paid at the salon`, `${salon.name}, ${salon.area}`];
  const action = cancelled
    ? `Book again: ${bookLink}`
    : link ? `Change or cancel (until 2 hours before): ${link}` : `To change or cancel, call us on ${salon.phoneDisplay}.`;

  const text = [`Hi ${firstName}, ${lines.intro}`, '', ...details, '', action, '', DEMO_NOTE].join('\n');
  const whatsappText = [`Hi ${firstName}, ${lines.intro}`, '', ...details.map((d) => `• ${d}`), '', action].join('\n');

  const html = `<!doctype html><html><body style="margin:0;background:#F3EEE6;font-family:Georgia,serif;color:#1B1A17">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font-size:22px;color:#0E2A23;margin:0 0 24px">${escapeHtml(salon.name)}</p>
<p style="font-size:17px;line-height:1.5;margin:0 0 20px">Hi ${escapeHtml(firstName)}, ${escapeHtml(lines.intro)}</p>
<div style="border:1px solid #E8E0D3;border-radius:12px;padding:16px 20px;background:#fff;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#0E2A23">
${details.map(escapeHtml).join('<br>')}
</div>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;margin:24px 0">${
  cancelled ? `<a href="${escapeHtml(bookLink)}" style="color:#0E2A23">Book again</a>`
  : link ? `<a href="${escapeHtml(link)}" style="display:inline-block;background:#0E2A23;color:#F3EEE6;padding:12px 22px;border-radius:999px;text-decoration:none">Change or cancel</a><br><span style="font-size:13px;color:#6b6760">Online until 2 hours before.</span>`
  : `To change or cancel, call us on ${escapeHtml(salon.phoneDisplay)}.`
}</p>
<p style="font-family:Arial,sans-serif;font-size:12px;color:#8a857c;margin-top:32px">${escapeHtml(DEMO_NOTE)}</p>
</div></body></html>`;

  return { subject: lines.subject, text, html, whatsappText, values };
}
