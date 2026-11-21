import { getBookingByToken } from '@/lib/booking.js';
import { salon } from '@/config/salon.js';

// "Add to calendar": a small .ics file that phones and computers open in their calendar app.

const icsTime = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // 20261205T080000Z
const icsText = (text) => String(text).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');

export async function GET(_request, { params }) {
  const { token } = await params;
  const booking = await getBookingByToken(token);
  if (!booking || booking.status !== 'confirmed') return new Response('Not found', { status: 404 });

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maison Ade//Booking//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.id}@maison-ade`,
    `DTSTAMP:${icsTime(new Date().toISOString())}`,
    `DTSTART:${icsTime(booking.starts_at)}`,
    `DTEND:${icsTime(booking.ends_at)}`,
    `SUMMARY:${icsText(`${booking.service.name} at ${salon.name}`)}`,
    `DESCRIPTION:${icsText(`With ${booking.stylist.name}. To change or cancel, call ${salon.phoneDisplay}.`)}`,
    `LOCATION:${icsText(salon.area)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="maison-ade-booking.ics"',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
