// Talking to the two message services. Each sender returns one of:
//   { ok: true, id }                         sent (the service's id for it)
//   { ok: false, error, retry: true|false }  failed; retry = worth trying again later (e.g. service busy)
//   { ok: false, skipped: true, error }      not set up, so nothing was attempted
// Errors are written in plain words for the staff message log.

const TIMEOUT_MS = 10_000;

/** Email via Resend (resend.com). Uses the message id as an "idempotency key", so a repeated send is ignored by Resend. */
export async function sendEmail({ to, subject, text, html, messageId }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, error: 'Email isn’t set up (RESEND_API_KEY is missing).' };
  const from = process.env.EMAIL_FROM || 'Maison Adé <onboarding@resend.dev>';

  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': messageId },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, retry: true, error: `Couldn’t reach Resend (${error.name === 'TimeoutError' ? 'timed out' : 'network error'}).` };
  }
  const body = await response.json().catch(() => ({}));
  if (response.ok && body.id) return { ok: true, id: String(body.id) };
  return { ok: false, retry: response.status === 429 || response.status >= 500, error: explainResendError(response.status, body.message) };
}

export function explainResendError(status, message = '') {
  if (status === 401 || status === 403) {
    if (/testing emails to your own email/i.test(message)) return 'Resend test mode only sends to your own Resend email address. Verify a domain in Resend to email customers.';
    return `Resend refused the key or sender (${status}): ${message}`.slice(0, 500);
  }
  if (status === 422) return `Resend didn’t accept the email (bad address or sender): ${message}`.slice(0, 500);
  if (status === 429) return 'Resend is rate-limiting us; will retry.';
  return `Resend error ${status}: ${message}`.slice(0, 500);
}

/**
 * WhatsApp via Meta's Cloud API. Free-form text, or an approved template when WHATSAPP_USE_TEMPLATES=on.
 * Note: "sent" means WhatsApp accepted it; it doesn't yet track whether it reached the phone.
 */
export async function sendWhatsApp({ to, text, template, values }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, skipped: true, error: 'WhatsApp isn’t set up (WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing).' };

  const useTemplate = process.env.WHATSAPP_USE_TEMPLATES === 'on' && template;
  const message = useTemplate
    ? {
      type: 'template',
      template: {
        name: template.name,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en' },
        ...(template.params.length ? { components: [{ type: 'body', parameters: template.params.map((p) => ({ type: 'text', text: String(values[p]).slice(0, 1000) })) }] } : {}),
      },
    }
    : { type: 'text', text: { body: text.slice(0, 4096), preview_url: true } };

  let response;
  try {
    const version = /^v\d+\.\d+$/.test(process.env.WHATSAPP_API_VERSION ?? '') ? process.env.WHATSAPP_API_VERSION : 'v25.0';
    response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/\D/g, ''), ...message }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, retry: true, error: `Couldn’t reach WhatsApp (${error.name === 'TimeoutError' ? 'timed out' : 'network error'}).` };
  }
  const body = await response.json().catch(() => ({}));
  const id = body?.messages?.[0]?.id;
  if (response.ok && id) return { ok: true, id: String(id) };
  const code = body?.error?.code;
  return { ok: false, retry: isRetryableWhatsApp(response.status, code), error: explainWhatsAppError(code, body?.error?.message) };
}

export function isRetryableWhatsApp(status, code) {
  return status === 429 || status >= 500 || [1, 2, 4, 80007, 130429, 131000, 131016, 131048, 131056].includes(code);
}

/** Meta's error codes, turned into something the salon can act on */
export function explainWhatsAppError(code, message = '') {
  const known = {
    190: 'WhatsApp token has expired or is wrong. Make a new one in Meta (see README) and update WHATSAPP_TOKEN.',
    131030: 'This number isn’t on the test number’s allowed list. Add it under WhatsApp > API Setup in Meta (max 5 numbers).',
    131047: 'The customer hasn’t messaged us in the last 24 hours, so WhatsApp only allows approved templates (see README).',
    132001: 'The WhatsApp template doesn’t exist or isn’t approved yet (check the name and language in Meta).',
    132000: 'The WhatsApp template got the wrong number of values.',
    131026: 'WhatsApp couldn’t deliver to this number (it may not use WhatsApp).',
    100: `WhatsApp rejected the request (check WHATSAPP_PHONE_NUMBER_ID): ${message}`,
  };
  return (known[code] ?? `WhatsApp error${code ? ` ${code}` : ''}: ${message || 'unknown'}`).slice(0, 500);
}
