import Link from 'next/link';
import { redirect } from 'next/navigation';
import Wordmark from '@/components/Wordmark.jsx';
import { isStaff } from '@/lib/staff-auth.js';
import LoginForm from './LoginForm.jsx';

export const metadata = { title: 'Staff login | Maison Adé', robots: { index: false, follow: false } };

export default async function StaffLoginPage() {
  if (await isStaff()) redirect('/staff');
  return (
    <main id="main" className="mx-auto flex min-h-[100svh] max-w-[26rem] flex-col justify-center px-5 py-16">
      <Link href="/" className="text-2xl text-emerald"><Wordmark /></Link>
      <h1 className="mt-10 font-display text-4xl font-[350] text-emerald">Staff</h1>
      <p className="mt-2 text-ink/65">The salon diary. Enter the salon password.</p>
      <LoginForm />
    </main>
  );
}
