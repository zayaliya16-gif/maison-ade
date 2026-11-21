'use client';

import Link from 'next/link';
import { salon } from '@/config/salon.js';

// Shown if the booking page can't load (for example, the database is unreachable). Never shows the technical error.
export default function BookingError({ reset }) {
  return (
    <main id="main" className="mx-auto flex min-h-[70svh] max-w-[40rem] flex-col items-start justify-center px-5 py-20">
      <h1 className="font-display text-[clamp(2rem,5vw,3rem)] font-[350] leading-none text-emerald">We can’t show the diary right now</h1>
      <p className="mt-5 text-lg leading-relaxed text-ink/70">
        Please try again in a minute. If it keeps happening, call us on {salon.phoneDisplay} and we’ll book you in.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="btn btn-emerald">Try again</button>
        <Link href="/" className="btn btn-line text-emerald">Back to the salon</Link>
      </div>
    </main>
  );
}
