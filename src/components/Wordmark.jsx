/**
 * "Maison Adé" where the accent on the é is a small brass crown (Adé means crown in Yoruba).
 * Screen readers hear the real name; the crown is decoration.
 */
export function Crown({ className = '', animate = false }) {
  return (
    <svg viewBox="0 0 40 24" className={`${animate ? 'crown-draw' : ''} ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 20 L3 7 L12 13 L20 3 L28 13 L37 7 L35 20 Z" />
      <path d="M6 20 H34" />
      <circle cx="3" cy="6" r="1.6" />
      <circle cx="20" cy="2.4" r="1.6" />
      <circle cx="37" cy="6" r="1.6" />
    </svg>
  );
}

export default function Wordmark({ size = 'sm', animate = false, className = '' }) {
  const big = size === 'lg';
  return (
    <span className={`font-display inline-flex items-baseline whitespace-nowrap ${className}`} aria-label="Maison Adé" role="img">
      <span aria-hidden="true">Maison Ad</span>
      <span aria-hidden="true" className="relative inline-block">
        e
        <Crown
          animate={animate}
          className={`absolute left-1/2 -translate-x-1/2 text-brass ${big ? 'top-[0.08em] left-[58%]! w-[0.44em]' : 'top-[0.02em] w-[0.55em]'}`}
        />
      </span>
    </span>
  );
}
