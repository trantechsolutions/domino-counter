import { useEffect } from 'react';
import { Routes, Route, Link, useLocation, useParams } from 'react-router-dom';
import { useTheme } from './lib/useTheme';
import { TileMark } from './components/Icons';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';

function RouteTitle() {
  const location = useLocation();
  useEffect(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      document.title = 'Bone & Pip · Domino Scorekeeper';
    } else {
      document.title = `Game ${segments[0].toUpperCase()} · Bone & Pip`;
    }
  }, [location.pathname]);
  return null;
}

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <div className="min-h-screen surface-paper text-[rgb(var(--ink))] antialiased">
      <RouteTitle />

      <div className="relative mx-auto px-5 py-6 sm:py-10 max-w-2xl">
        <header className="mb-7 sm:mb-10">
          <div className="flex items-center justify-between w-full">
            <Link to="/" className="flex items-center gap-3 group" aria-label="Home">
              <TileMark className="w-12 h-6 sm:w-14 sm:h-7 transition-transform group-hover:-rotate-3" />
              <div>
                <h1 className="t-h2 text-[rgb(var(--ink))] leading-none">Bone &amp; Pip</h1>
                <p className="t-micro text-[rgb(var(--ink-subtle))] mt-1.5">
                  <span className="pip mr-1.5" style={{ width: 4, height: 4, verticalAlign: 'middle' }} />
                  Domino Scorekeeper
                </p>
              </div>
            </Link>
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="tap rounded-xl flex items-center justify-center surface-bone border border-[rgb(var(--rule))] text-[rgb(var(--ink-muted))] hover:text-[rgb(var(--ink))] hover:border-[rgb(var(--ink-subtle))] transition-colors"
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<LobbyPage />} />
            <Route path="/:gameId" element={<GamePage />} />
          </Routes>
        </main>

        <footer className="text-center mt-12 pb-6">
          <div className="flex justify-center items-center gap-1.5 mb-2 opacity-60" aria-hidden="true">
            <span className="pip" /><span className="pip" /><span className="pip" />
          </div>
          <p className="t-micro text-[rgb(var(--ink-subtle))]">A scoreboard for the table</p>
        </footer>
      </div>
    </div>
  );
}
