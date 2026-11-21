'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { submitBooking } from './actions.js';

// The details form (step 4). Works without JavaScript too; with it, errors show without a page reload.
export default function BookingForm({ choice, backToTimes }) {
  const [state, action, pending] = useActionState(submitBooking, null);
  const values = state?.values ?? { whatsapp: 'on' };
  const errors = state?.errors ?? {};

  return (
    // `key` makes the form start fresh with the kept values after each attempt
    <form key={state?.attempt ?? 0} action={action} noValidate className="mt-10 space-y-6">
      {state?.message && (
        <div role="alert" className="rounded-[14px] bg-brass-light/40 px-5 py-4 text-emerald">
          <p>{state.message}</p>
          {state.reason === 'taken' && (
            <Link href={backToTimes} className="mt-2 inline-block font-medium underline underline-offset-4">See the free times</Link>
          )}
        </div>
      )}

      {Object.entries(choice).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}

      <Field label="Your name" name="name" autoComplete="name" defaultValue={values.name} error={errors.name} maxLength={100} />
      <Field label="Mobile number" name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={values.phone} error={errors.phone}
        hint="For your WhatsApp confirmation and reminders. Nigerian numbers can start with 0." maxLength={30} />
      <Field label="Email (optional)" name="email" type="email" autoComplete="email" defaultValue={values.email} error={errors.email} maxLength={254} />

      <fieldset className="space-y-3">
        <legend className="text-sm text-ink/70">Remind me before my visit</legend>
        <Check name="whatsapp" label="On WhatsApp" defaultChecked={values.whatsapp === 'on'} />
        <Check name="emailReminders" label="By email" defaultChecked={values.emailReminders === 'on'} />
      </fieldset>

      {/* Honeypot: hidden from people, tempting to bots. Never shown, never read aloud. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Company <input type="text" name="company" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button type="submit" disabled={pending} className="btn btn-emerald disabled:opacity-60">
          {pending ? 'Booking…' : 'Confirm booking'}
        </button>
        <p className="text-sm text-ink/55">No payment now. You pay at the salon.</p>
      </div>
    </form>
  );
}

function Field({ label, name, error, hint, ...input }) {
  const describedBy = [error && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={name} className="block text-sm text-ink/70">{label}</label>
      <input id={name} name={name} type="text" aria-invalid={Boolean(error)} aria-describedby={describedBy} {...input}
        className={`mt-2 block h-12 w-full rounded-[12px] border bg-white/70 px-4 text-[1rem] text-ink outline-none transition-colors focus:border-emerald ${error ? 'border-red-700' : 'border-linen'}`} />
      {hint && !error && <p id={`${name}-hint`} className="mt-1.5 text-sm text-ink/50">{hint}</p>}
      {error && <p id={`${name}-error`} className="mt-1.5 text-sm text-red-800">{error}</p>}
    </div>
  );
}

function Check({ name, label, defaultChecked }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-5 accent-emerald" />
      <span className="text-emerald">{label}</span>
    </label>
  );
}
