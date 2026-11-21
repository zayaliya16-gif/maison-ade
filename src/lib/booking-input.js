// Checking and cleaning what customers type into the booking form.
// "Pure" (no database), so it runs in tests and on the server. The browser never decides what's valid.

const LIMITS = { name: 100, email: 254 };

/**
 * Turns the ways people write phone numbers into one format (+234...), or null if it isn't a phone number.
 * "0803 123 4567", "08031234567", "234 803 123 4567", "+234 (0) 803-123-4567" → "+2348031234567"
 * Other countries must start with + : "+44 7700 900123" → "+447700900123"
 */
export function normalizePhone(raw) {
  const text = String(raw ?? '').trim();
  if (text.length === 0 || text.length > 30) return null;
  if (!/^[+\d\s().-]+$/.test(text)) return null; // only digits, spaces and + ( ) . -

  const plus = text.startsWith('+');
  let digits = text.replace(/\D/g, '');

  if (!plus) {
    if (/^0[789][01]\d{8}$/.test(digits)) return `+234${digits.slice(1)}`; // local Nigerian mobile: 080, 081, 070, 090, 091...
    if (!/^234\d{10}$/.test(digits)) return null; // otherwise only "234..." is accepted without a +
  }

  if (digits.startsWith('2340')) digits = `234${digits.slice(4)}`; // "+234 (0) 803..." → drop the 0
  if (digits.startsWith('234') && !/^234[789][01]\d{8}$/.test(digits)) return null; // Nigerian, but not a mobile number
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null; // international numbers are 8 to 15 digits
  return `+${digits}`;
}

/** "  ada   OKAFOR " → "ada OKAFOR". Null if empty, too long, or has odd characters. */
export function cleanName(raw) {
  const name = String(raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > LIMITS.name) return null;
  if (/[\p{C}<>{}]/u.test(name)) return null; // no invisible control characters or code-like brackets
  if (!/\p{L}/u.test(name)) return null; // must contain at least one letter
  return name;
}

/** Lower-cased email, '' if left blank, or null if it doesn't look like an email */
export function cleanEmail(raw) {
  const email = String(raw ?? '').trim().toLowerCase();
  if (email === '') return '';
  if (email.length > LIMITS.email) return null;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

/**
 * Checks the whole details form.
 * @param {{ name, phone, email, whatsapp, emailReminders }} input  raw form values (checkboxes are "on" when ticked)
 * @returns {{ ok: true, customer } | { ok: false, errors }}  errors are keyed by field, written for customers
 */
export function parseCustomer(input) {
  const errors = {};
  const name = cleanName(input.name);
  const phone = normalizePhone(input.phone);
  const email = cleanEmail(input.email);
  const whatsappOptIn = input.whatsapp === 'on';
  const emailOptIn = input.emailReminders === 'on';

  if (!name) errors.name = 'Please enter your name (2 to 100 characters).';
  if (!phone) errors.phone = 'Please enter a mobile number, like 0803 123 4567 or +44 7700 900123.';
  if (email === null) errors.email = 'That email address doesn’t look right.';
  else if (emailOptIn && email === '') errors.email = 'Add your email for email reminders, or untick that box.';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, customer: { name, phone, email: email || null, whatsappOptIn, emailOptIn } };
}

/**
 * For "any stylist": choose whoever has the fewest bookings that day, so work is shared fairly.
 * Ties go to the first in the list (the salon's order).
 * @param {string[]} staffIds        free stylists, in salon order
 * @param {Map<string, number>} countByStaff  bookings each already has that day
 * @returns {string[]} the stylists in the order to try
 */
export function rankStylists(staffIds, countByStaff) {
  return staffIds
    .map((id, index) => ({ id, index, count: countByStaff.get(id) ?? 0 }))
    .sort((a, b) => a.count - b.count || a.index - b.index)
    .map((s) => s.id);
}
