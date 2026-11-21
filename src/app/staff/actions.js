'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { notify, retryMessage } from '@/lib/messages/outbox.js';
import { logIn, logOut, requireStaff, LOCK_MINUTES } from '@/lib/staff-auth.js';
import { addTimeOff, isUuid, removeTimeOff } from '@/lib/staff.js';
import { cancelBooking } from '@/lib/booking.js';
import { parseDate } from '@/lib/availability.js';

// Staff actions. Every one (except logging in) checks the login again first:
// hiding a button isn't security, checking on the server is.

const field = (formData, name, max = 200) => String(formData.get(name) ?? '').slice(0, max);

/** Where to go back to: the day the staff member was looking at */
function dayLink(formData, note) {
  const date = field(formData, 'returnDate', 10);
  let valid = true;
  try { parseDate(date); } catch { valid = false; }
  const params = new URLSearchParams();
  if (valid) params.set('date', date);
  if (note) params.set('note', note);
  return `/staff?${params}`;
}

export async function loginAction(previous, formData) {
  let result;
  try {
    result = await logIn(field(formData, 'password', 200));
  } catch (error) {
    console.error('Staff login failed', error);
    return { message: 'Something went wrong. Please try again in a minute.' };
  }
  if (result.ok) redirect('/staff');
  if (result.reason === 'locked') return { message: `Too many wrong passwords. Please wait ${LOCK_MINUTES} minutes and try again.` };
  if (result.reason === 'not-set-up') return { message: 'Staff login isn’t set up yet (STAFF_PASSWORD is missing or shorter than 12 characters).' };
  return { message: 'That password isn’t right.' };
}

export async function logoutAction() {
  await logOut();
  redirect('/staff/login');
}

export async function addTimeOffAction(formData) {
  await requireStaff();
  let result;
  try {
    result = await addTimeOff({
      staffId: field(formData, 'staffId', 40),
      startDate: field(formData, 'startDate', 10),
      startTime: field(formData, 'startTime', 5),
      endDate: field(formData, 'endDate', 10),
      endTime: field(formData, 'endTime', 5),
      reason: field(formData, 'reason', 200),
    });
  } catch (error) {
    console.error('Add time off failed', error);
    redirect(dayLink(formData, 'error'));
  }
  if (!result.ok) redirect(dayLink(formData, 'timeoff-invalid'));
  redirect(dayLink(formData, result.clashes ? `timeoff-clash-${Math.min(result.clashes, 99)}` : 'timeoff-added'));
}

export async function removeTimeOffAction(formData) {
  await requireStaff();
  try {
    await removeTimeOff(field(formData, 'id', 36));
  } catch (error) {
    console.error('Remove time off failed', error);
    redirect(dayLink(formData, 'error'));
  }
  redirect(dayLink(formData, 'timeoff-removed'));
}

export async function staffCancelAction(formData) {
  await requireStaff();
  const id = field(formData, 'id', 36);
  if (!isUuid(id)) redirect(dayLink(formData, 'error'));
  let result;
  try {
    result = await cancelBooking(id, 'staff');
  } catch (error) {
    console.error('Staff cancel failed', error);
    redirect(dayLink(formData, 'error'));
  }
  if (result.ok) after(() => notify(id, 'cancelled')); // tell the customer
  redirect(dayLink(formData, 'booking-cancelled'));
}

export async function retryMessageAction(formData) {
  await requireStaff();
  const id = field(formData, 'id', 36);
  if (!isUuid(id)) redirect('/staff/messages');
  try {
    await retryMessage(id);
  } catch (error) {
    console.error('Retry message failed', error);
  }
  redirect('/staff/messages');
}
