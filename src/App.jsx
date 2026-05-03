import { Routes, Route, Link } from 'react-router-dom';
import { useTheme } from './lib/useTheme';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <div className="min-h-screen font-sans bg-slate-50 dark:bg-[#0b0a14]">
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-violet-600/10 dark:bg-violet-600/5 blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] rounded-full bg-indigo-500/8 dark:bg-indigo-500/4 blur-3xl" />
      </div>

      <div className="relative mx-auto px-4 py-5 sm:py-8 max-w-2xl">
        <header className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between w-full">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="grad-brand w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0 group-hover:opacity-90 transition-opacity">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="9" height="20" rx="2" />
                  <rect x="13" y="2" width="9" height="20" rx="2" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 leading-none">Domino Suite</h1>
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5 font-medium">Score Tracking · Pip Counter</p>
              </div>
            </Link>
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/:gameId" element={<GamePage />} />
        </Routes>

        <footer className="text-center mt-10 pb-6 text-slate-400 dark:text-slate-600 text-xs">
          Built with React &amp; Firebase
        </footer>
      </div>
    </div>
  );
}
