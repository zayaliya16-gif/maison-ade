'use client';

import { useFormStatus } from 'react-dom';

// A submit button that asks "Are you sure?" first. Without JavaScript it simply submits (the server still checks everything).
export default function ConfirmButton({ question, children, pendingText = 'One moment…', className = 'btn btn-line text-emerald' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:opacity-60`}
      onClick={(event) => { if (!window.confirm(question)) event.preventDefault(); }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
