'use server';

import { redirect } from 'next/navigation';
import { createBooking, MAX_UPCOMING_PER_PHONE } from '@/lib/booking.js';
import { parseCustomer } from '@/lib/booking-input.js';
import { parseDate } from '@/lib/availability.js';
import { salon } from '@/config/salon.js';

// Runs on our server when the customer presses "Confirm booking".
// The browser only sends text; every value is checked again here before anything is saved.

const ID_RE = /^[a-z0-9-]{1,40}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function submitBooking(previous, formData) {
  const field = (name) => String(formData.get(name) ?? '').slice(0, 300);
  const values = { name: field('name'), phone: field('phone'), email: field('email'), whatsapp: field('whatsapp'), emailReminders: field('emailReminders') };
  const attempt = (previous?.attempt ?? 0) + 1;
  const fail = (extra) => ({ attempt, values, ...extra });

  // Hidden "honeypot" box: people never see it, bots fill everything in
  if (field('company')) return fail({ message: 'Something went wrong. Please try again.' });

  // The appointment they picked (from hidden fields; could have been tampered with)
  const choice = { service: field('service'), staff: field('staff'), date: field('date'), time: field('time') };
  let validDate = true;
  try { parseDate(choice.date); } catch { validDate = false; }
  if (!ID_RE.test(choice.service) || !ID_RE.test(choice.staff) || !validDate || !TIME_RE.test(choice.time)) {
    return fail({ message: 'That appointment isn’t available. Please choose a time again.', reason: 'taken' });
  }

  const parsed = parseCustomer(values);
  if (!parsed.ok) return fail({ errors: parsed.errors });

  let result;
  try {
    result = await createBooking({ serviceId: choice.service, staffChoice: choice.staff, date: choice.date, time: choice.time, customer: parsed.customer });
  } catch (error) {
    console.error('Booking failed', error); // shows in the Vercel logs, never to the customer
    return fail({ message: `We couldn’t save your booking just now. Please try again in a minute, or call us on ${salon.phoneDisplay}.` });
  }

  if (!result.ok && result.reason === 'taken') {
    return fail({ reason: 'taken', message: 'Sorry, someone has just booked that time. Please pick another; your details are kept.' });
  }
  if (!result.ok && result.reason === 'limit') {
    return fail({ message: `This phone number already has ${MAX_UPCOMING_PER_PHONE} upcoming bookings. To book more, please call us on ${salon.phoneDisplay}.` });
  }

  // Booked: go to the private confirmation page (outside try/catch: redirect works by throwing)
  redirect(`/b/${result.token}`);
}
