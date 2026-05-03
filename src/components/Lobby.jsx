import { useState, useEffect } from 'react';
import { db, auth, collection, getDocs, doc, deleteDoc, signInWithEmailAndPassword } from '../lib/firebase';
import { LockIcon } from './Icons';
import UpdateLog from './UpdateLog';
import ConfirmDialog from './ConfirmDialog';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Lobby({ onCreateGame, onJoinGame, isLoading, authUser, isSuperAdmin, onSignOut }) {
  const [joinId, setJoinId] = useState('');
  const [allGames, setAllGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const loadGames = () => {
    setLoadingGames(true);
    getDocs(collection(db, 'dominoGames'))
      .then((snapshot) => {
        const games = [];
        snapshot.forEach((d) => {
          const data = d.data();
          games.push({
            id: d.id,
            players: data.players || [],
            rounds: data.rounds || [],
            createdAt: data.createdAt,
            finished: data.finished || false,
            winner: data.winner || null,
          });
        });
        games.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return bTime - aTime;
        });
        setAllGames(games);
      })
      .catch((err) => console.error('Failed to load games:', err))
      .finally(() => setLoadingGames(false));
  };

  useEffect(() => {
    if (isSuperAdmin) loadGames();
    else setAllGames([]);
  }, [isSuperAdmin]);

  const handleDelete = (e, gameId) => {
    e.stopPropagation();
    setConfirmDialog({
      title: 'Delete Game',
      message: `Delete game ${gameId}? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        await deleteDoc(doc(db, 'dominoGames', gameId));
        setAllGames((prev) => prev.filter((g) => g.id !== gameId));
      },
    });
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setShowAdminLogin(false);
      setLoginEmail('');
      setLoginPassword('');
    } catch (err) {
      setLoginError(
        err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
          ? 'Invalid email or password.'
          : 'Sign-in failed. Try again.'
      );
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Create game */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="absolute inset-0 grad-surface pointer-events-none" />
          <div className="relative">
            <div className="w-8 h-8 grad-brand rounded-xl flex items-center justify-center mb-3 shadow-md shadow-violet-500/25">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-0.5">New Game</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Start a fresh scoreboard</p>
            <button
              onClick={onCreateGame}
              disabled={isLoading}
              className="w-full grad-brand text-white text-sm font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-violet-500/20 hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        </div>

        {/* Join game */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-3">
            <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-0.5">Join Game</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Enter a 6-character Game ID</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (joinId.trim()) onJoinGame(joinId.trim());
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder="ABC123"
              maxLength="6"
              aria-label="Game ID"
              className="flex-1 min-w-0 px-3 py-2.5 text-center font-mono tracking-[0.25em] uppercase text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 transition"
            />
            <button
              type="submit"
              disabled={isLoading || !joinId.trim()}
              className="bg-slate-800 dark:bg-slate-700 text-white text-sm font-semibold py-2.5 px-4 rounded-xl hover:bg-slate-900 dark:hover:bg-slate-600 transition disabled:opacity-50 shrink-0"
            >
              Join
            </button>
          </form>
        </div>
      </div>

      {/* Super admin: all games */}
      {isSuperAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">All Games</h3>
              <span className="text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Admin</span>
            </div>
            <button onClick={loadGames} className="text-xs text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 transition font-medium">
              Refresh
            </button>
          </div>
          {loadingGames ? (
            <div className="p-8 flex justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-violet-400 border-t-transparent" style={{ animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : allGames.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">No games yet. Create one to get started!</div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/70">
              {allGames.map((game) => (
                <div
                  key={game.id}
                  onClick={() => onJoinGame(game.id)}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-violet-50 dark:hover:bg-violet-900/10 active:bg-violet-100 dark:active:bg-violet-900/20 transition cursor-pointer"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    game.finished
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                  }`}>
                    {game.finished ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-1.17a3 3 0 01-1.83 1.83V14h1a2 2 0 110 4H6a2 2 0 110-4h1v-2.17A3 3 0 015.17 10H4a2 2 0 110-4h1.17A3 3 0 015 5z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span>{game.rounds.length}R</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-violet-600 dark:text-violet-400 tracking-wider text-sm">{game.id}</span>
                      {game.finished && (
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1 uppercase tracking-wide">
                          <LockIcon className="w-2.5 h-2.5" />
                          Finished
                        </span>
                      )}
                      {game.players.length > 0 && !game.finished && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                          {game.players.length}p
                        </span>
                      )}
                    </div>
                    {game.players.length > 0 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {game.winner ? `🏆 ${game.winner}` : game.players.map((p) => p.name).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">{formatDate(game.createdAt)}</div>
                  <button
                    onClick={(e) => handleDelete(e, game.id)}
                    aria-label="Delete game"
                    className="text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Update log */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <UpdateLog />
      </div>

      {/* Admin auth footer */}
      <div className="text-center">
        {authUser && !authUser.isAnonymous ? (
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              <span className="font-medium text-slate-600 dark:text-slate-300">{authUser.email}</span>
              {isSuperAdmin && <span className="ml-1.5 text-violet-500 dark:text-violet-400 font-semibold">· Super Admin</span>}
            </span>
            <button onClick={onSignOut} className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition font-medium">
              Sign out
            </button>
          </div>
        ) : showAdminLogin ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm text-left max-w-sm mx-auto scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Admin Sign In</h3>
              <button onClick={() => { setShowAdminLogin(false); setLoginError(''); }} aria-label="Close"
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Email"
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition"
              />
              {loginError && <p className="text-xs text-red-600 dark:text-red-400">{loginError}</p>}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full grad-brand text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-50 text-sm"
              >
                {loginLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowAdminLogin(true)}
            className="text-xs text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 transition"
          >
            Admin
          </button>
        )}
      </div>

      {confirmDialog && (
        <ConfirmDialog
          open
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
