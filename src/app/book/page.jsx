import Link from 'next/link';
import Wordmark from '@/components/Wordmark.jsx';

export const metadata = { title: 'Book a visit | Maison Adé' };

// Placeholder until the booking flow is built (project 4, phase 3)
export default function BookPage() {
  return (
    <main id="main" className="mx-auto flex min-h-[100svh] max-w-[40rem] flex-col items-start justify-center px-5 py-20">
      <Link href="/" className="text-2xl text-emerald"><Wordmark /></Link>
      <h1 className="mt-12 font-display text-[clamp(2.4rem,6vw,4rem)] font-[350] leading-none text-emerald">Online booking opens soon</h1>
      <p className="mt-5 text-lg leading-relaxed text-ink/70">
        You’ll be able to choose a service, a stylist and a time that really fits, then get reminders before you come.
      </p>
      <Link href="/#menu" className="btn btn-emerald mt-10">See the menu</Link>
    </main>
  );
}
