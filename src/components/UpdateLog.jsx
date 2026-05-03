import { useState } from 'react';

const UPDATES = [
  {
    version: '1.5.0',
    date: '2026-05-03',
    changes: [
      'Devices now remember which player you are when rejoining a game',
      'Round winner button (0 pts) added to score entry — only one winner allowed per round',
      'Super admin login to view all games across sessions',
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
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800 text-sm">What's New</span>
          <span className="text-xs bg-indigo-100 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">
            v{UPDATES[0].version}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {UPDATES.map((release) => (
            <div key={release.version} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-gray-700">v{release.version}</span>
                <span className="text-xs text-gray-400">{release.date}</span>
              </div>
              <ul className="space-y-1">
                {release.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="text-indigo-400 mt-0.5 shrink-0">·</span>
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
