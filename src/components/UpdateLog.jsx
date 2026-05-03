import { useState } from 'react';

const UPDATES = [
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
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">What's New</span>
          <span className="text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
            v{UPDATES[0].version}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800/60 max-h-72 overflow-y-auto">
          {UPDATES.map((release, i) => (
            <div key={release.version} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold ${i === 0 ? 'text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}>
                  v{release.version}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{release.date}</span>
                {i === 0 && (
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Latest</span>
                )}
              </div>
              <ul className="space-y-1.5">
                {release.changes.map((change, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-violet-400 dark:text-violet-500 mt-px shrink-0">·</span>
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
