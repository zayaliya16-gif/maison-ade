'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { notify } from '@/lib/messages/outbox.js';
import { cancelByToken, moveByToken } from '@/lib/booking.js';
import { parseDate } from '@/lib/availability.js';

// Customer actions from their private link. The token in the form is checked like any other input:
// a wrong or made-up one simply finds no booking.

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function readToken(formData) {
  const token = String(formData.get('token') ?? '');
  if (!TOKEN_RE.test(token)) redirect('/');
  return token;
}

export async function cancelAction(formData) {
  const token = readToken(formData);
  let result;
  try {
    result = await cancelByToken(token);
  } catch (error) {
    console.error('Cancel failed', error);
    redirect(`/b/${token}?note=error`);
  }
  if (result.ok) after(() => notify(result.bookingId, 'cancelled'));
  redirect(`/b/${token}?note=${result.ok ? 'cancelled' : result.reason}`);
}

export async function moveAction(formData) {
  const token = readToken(formData);
  const date = String(formData.get('date') ?? '');
  const time = String(formData.get('time') ?? '');
  try { parseDate(date); } catch { redirect(`/b/${token}/change`); }
  if (!TIME_RE.test(time)) redirect(`/b/${token}/change`);

  let result;
  try {
    result = await moveByToken(token, { date, time });
  } catch (error) {
    console.error('Move failed', error);
    redirect(`/b/${token}?note=error`);
  }
  if (result.ok) {
    after(() => notify(result.bookingId, 'moved'));
    redirect(`/b/${token}?note=moved`);
  }
  if (result.reason === 'taken') redirect(`/b/${token}/change?date=${date}&note=taken`);
  redirect(`/b/${token}?note=${result.reason}`);
}
