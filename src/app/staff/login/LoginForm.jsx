'use client';

import { useActionState } from 'react';
import { loginAction } from '../actions.js';

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-8 space-y-4">
      {state?.message && <p role="alert" className="rounded-[12px] bg-brass-light/40 px-4 py-3 text-emerald">{state.message}</p>}
      <div>
        <label htmlFor="password" className="block text-sm text-ink/70">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={200}
          className="mt-2 block h-12 w-full rounded-[12px] border border-linen bg-white/70 px-4 text-[1rem] outline-none focus:border-emerald" />
      </div>
      <button type="submit" disabled={pending} className="btn btn-emerald w-full disabled:opacity-60">{pending ? 'Checking…' : 'Log in'}</button>
    </form>
  );
}
