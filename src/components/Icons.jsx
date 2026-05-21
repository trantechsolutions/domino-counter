// ─────────────────────────────────────────────────────────────
// Bone & Pip — Identity icons
// Pip dots, domino tile, and supporting glyphs.
// ─────────────────────────────────────────────────────────────

export function PlayerIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={`${className} text-[rgb(var(--ink-subtle))]`} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* The product mark: a 2:1 domino tile with a 6-3 face.
   Used in the header and as the favicon-style anchor. */
export function TileMark({ className = 'w-8 h-8' }) {
  return (
    <svg className={className} viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.75" y="0.75" width="46.5" height="22.5" rx="3.5"
        fill="rgb(var(--bone))" stroke="rgb(var(--ink))" strokeWidth="1.5" />
      <line x1="24" y1="3" x2="24" y2="21" stroke="rgb(var(--ink))" strokeWidth="1" />
      {/* Left half: six pips */}
      <circle cx="8"  cy="7"  r="1.6" fill="rgb(var(--brand))" />
      <circle cx="16" cy="7"  r="1.6" fill="rgb(var(--ink))" />
      <circle cx="8"  cy="12" r="1.6" fill="rgb(var(--ink))" />
      <circle cx="16" cy="12" r="1.6" fill="rgb(var(--ink))" />
      <circle cx="8"  cy="17" r="1.6" fill="rgb(var(--ink))" />
      <circle cx="16" cy="17" r="1.6" fill="rgb(var(--ink))" />
      {/* Right half: three pips */}
      <circle cx="32" cy="7"  r="1.6" fill="rgb(var(--ink))" />
      <circle cx="36" cy="12" r="1.6" fill="rgb(var(--ink))" />
      <circle cx="40" cy="17" r="1.6" fill="rgb(var(--ink))" />
    </svg>
  );
}

/* Animated pip-grid loader — replaces all spinners */
export function PipLoader({ label }) {
  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <div className="pip-grid" aria-hidden="true">
        <span className="pip" /><span className="pip" /><span className="pip" />
        <span className="pip" /><span className="pip pip-brand" /><span className="pip" />
        <span className="pip" /><span className="pip" /><span className="pip" />
      </div>
      {label && <p className="t-micro text-[rgb(var(--ink-subtle))]">{label}</p>}
    </div>
  );
}

/* Crown stamp for the winner — drawn, not emoji */
export function CrownIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 8l3.5 3 3-5 2.5 5 2.5-5 3 5L21 8l-1.5 9.5h-15L3 8zm2 11h14v1.5H5V19z" />
    </svg>
  );
}

/* Used as the secondary rank indicator */
export function MedalIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3 6 6 .8-4.5 4 1.2 6.2L12 16l-5.7 3 1.2-6.2L3 8.8 9 8l3-6z" />
    </svg>
  );
}

export function LockIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

/* Backwards-compat exports — older imports kept resolving */
export const GoldMedalIcon = MedalIcon;
export const TrophyIcon = CrownIcon;
