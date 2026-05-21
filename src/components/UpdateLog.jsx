import { useState } from 'react';

const UPDATES = [
  {
    version: '1.6.0',
    date: '2026-05-21',
    changes: [
      'Bone & Pip redesign — new identity, typography, and 44px tap targets throughout',
      'Per-route page titles for bookmarkable games',
      'Reduced-motion support and hue-shifted shadows',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-05-03',
    changes: [
      'Devices now remember which player you are when rejoining a game',
      'Round winner button (0 pts) added to score entry — only one winner allowed per round',
      'Super admin login to view all games across sessions',
      'Dark mode support across all screens',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-05-03',
    changes: [
      'After scanning dominoes, the captured image now fills the full screen for easier pip review',
      'App icon updated to a domino tile design',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-04-28',
    changes: [
      'Tap-to-score modal with AI pip scanner',
      'Rounds R12 to R0 labelling for Mexican Train',
      'PWA caching disabled to ensure latest version always loads',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-04-20',
    changes: [
      'Multi-device per-player score entry',
      'Host/player role split — host submits rounds, players enter their own scores',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-04-15',
    changes: [
      'Claim Host button for existing games',
      'Inline score and player name editing',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-04-10',
    changes: [
      'Initial release — create and join games, track scores across 13 rounds',
      'Real-time sync via Firebase',
    ],
  },
];

export default function UpdateLog() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="tap w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[rgb(var(--rule-soft))] transition"
      >
        <div className="flex items-center gap-2">
          <span className="t-body font-bold text-[rgb(var(--ink))]">What's new</span>
          <span className="t-micro fill-brand px-2 py-0.5 rounded-full font-num normal-case tracking-normal" style={{ letterSpacing: 0 }}>
            v{UPDATES[0].version}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-[rgb(var(--ink-subtle))] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-[rgb(var(--rule-soft))] max-h-72 overflow-y-auto">
          {UPDATES.map((release, i) => (
            <div key={release.version} className="px-5 py-4 border-b border-[rgb(var(--rule-soft))] last:border-b-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`font-num t-small font-bold ${i === 0 ? 'text-[rgb(var(--brand))]' : 'text-[rgb(var(--ink-muted))]'}`}>
                  v{release.version}
                </span>
                <span className="font-num t-small text-[rgb(var(--ink-subtle))]">{release.date}</span>
                {i === 0 && (
                  <span className="t-micro text-[rgb(var(--success))] bg-[rgba(34,120,80,0.1)] px-1.5 py-0.5 rounded-full">Latest</span>
                )}
              </div>
              <ul className="space-y-1.5">
                {release.changes.map((change, j) => (
                  <li key={j} className="flex items-start gap-2 t-small text-[rgb(var(--ink-muted))]">
                    <span className="pip mt-1.5 shrink-0" style={{ width: 4, height: 4, background: 'rgb(var(--brand))' }} />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
