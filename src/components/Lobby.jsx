import { useState, useEffect } from 'react';
import { db, auth, collection, getDocs, doc, deleteDoc, signInWithEmailAndPassword } from '../lib/firebase';
import { LockIcon, CrownIcon, PipLoader } from './Icons';
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
      title: 'Delete game',
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
    <div className="space-y-5">
      {/* ────── Hero ────── */}
      <section className="text-center pb-3">
        <p className="t-micro text-[rgb(var(--ink-subtle))] mb-2">
          <span className="pip" style={{ width: 4, height: 4, verticalAlign: 'middle', marginRight: 6 }} />
          Round-by-round scoring
        </p>
        <h2 className="t-h1 text-[rgb(var(--ink))]">Set the table.</h2>
        <p className="t-body text-[rgb(var(--ink-muted))] mt-2 max-w-md mx-auto">
          Start a new game or join an existing one. Every phone at the table sees the same scoreboard.
        </p>
      </section>

      {/* ────── Action cards ────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Create — primary, branded */}
        <div className="relative overflow-hidden fill-brand p-5 rounded-2xl shadow-pip-brand">
          <div className="absolute -right-6 -bottom-6 opacity-15" aria-hidden="true">
            <div className="grid grid-cols-3 grid-rows-3 gap-2.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className="pip pip-lg" style={{ background: 'white' }} />
              ))}
            </div>
          </div>
          <div className="relative">
            <p className="t-micro text-white/70">New</p>
            <h3 className="t-h2 text-white mt-1">Start a game</h3>
            <p className="t-small text-white/80 mt-1 mb-5">Fresh scoreboard, fresh round</p>
            <button
              onClick={onCreateGame}
              disabled={isLoading}
              className="tap w-full bg-white text-[rgb(var(--brand))] t-body font-bold py-3 rounded-xl hover:bg-[rgb(var(--bone-raised))] transition disabled:opacity-50"
            >
              {isLoading ? 'Creating…' : 'Create game'}
            </button>
          </div>
        </div>

        {/* Join — secondary */}
        <div className="surface-bone p-5 rounded-2xl border border-[rgb(var(--rule))] shadow-pip">
          <p className="t-micro text-[rgb(var(--ink-subtle))]">Join</p>
          <h3 className="t-h2 text-[rgb(var(--ink))] mt-1">Enter game ID</h3>
          <p className="t-small text-[rgb(var(--ink-muted))] mt-1 mb-4">Six characters from the host</p>
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
              className="tap flex-1 min-w-0 px-3 text-center font-num font-bold tracking-[0.25em] uppercase text-base border-2 border-[rgb(var(--rule))] rounded-xl focus:border-brand outline-none surface-paper text-[rgb(var(--ink))] placeholder-[rgb(var(--ink-subtle))] transition"
            />
            <button
              type="submit"
              disabled={isLoading || !joinId.trim()}
              className="tap bg-[rgb(var(--ink))] text-[rgb(var(--paper))] t-body font-semibold px-5 rounded-xl hover:bg-[rgb(var(--ink-muted))] transition disabled:opacity-40 shrink-0"
            >
              Join
            </button>
          </form>
        </div>
      </div>

      {/* ────── Admin: all games ────── */}
      {isSuperAdmin && (
        <section className="surface-bone rounded-2xl border border-[rgb(var(--rule))] shadow-pip overflow-hidden">
          <header className="px-5 py-4 border-b border-[rgb(var(--rule-soft))] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="t-h2 text-[rgb(var(--ink))]" style={{ fontSize: 15 }}>All games</h3>
              <span className="t-micro fill-brand px-2 py-0.5 rounded-full">Admin</span>
            </div>
            <button onClick={loadGames} className="tap t-small text-[rgb(var(--ink-muted))] hover:text-[rgb(var(--brand))] transition font-semibold px-2">
              Refresh
            </button>
          </header>
          {loadingGames ? (
            <div className="p-10 flex justify-center"><PipLoader /></div>
          ) : allGames.length === 0 ? (
            <div className="p-10 text-center text-[rgb(var(--ink-subtle))] t-body">No games yet — create one to get started.</div>
          ) : (
            <ul>
              {allGames.map((game) => (
                <li
                  key={game.id}
                  onClick={() => onJoinGame(game.id)}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-[rgb(var(--brand-soft))] transition cursor-pointer border-b border-[rgb(var(--rule-soft))] last:border-b-0"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-num font-bold text-xs shrink-0 border ${
                    game.finished
                      ? 'border-[rgb(var(--brand))] text-[rgb(var(--brand))] bg-[rgb(var(--brand-soft))]'
                      : 'border-[rgb(var(--rule))] text-[rgb(var(--ink-muted))]'
                  }`}>
                    {game.finished ? <CrownIcon className="w-4 h-4" /> : <span>{game.rounds.length}R</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-num font-bold text-[rgb(var(--brand))] tracking-wider t-body">{game.id}</span>
                      {game.finished && (
                        <span className="t-micro text-[rgb(var(--brand))] bg-[rgb(var(--brand-soft))] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <LockIcon className="w-2.5 h-2.5" />
                          Finished
                        </span>
                      )}
                      {game.players.length > 0 && !game.finished && (
                        <span className="t-micro text-[rgb(var(--ink-subtle))] surface-paper border border-[rgb(var(--rule))] px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                          {game.players.length}p
                        </span>
                      )}
                    </div>
                    {game.players.length > 0 && (
                      <p className="t-small text-[rgb(var(--ink-subtle))] truncate mt-0.5">
                        {game.winner ? (
                          <span className="inline-flex items-center gap-1">
                            <CrownIcon className="w-3 h-3 text-[rgb(var(--brand))]" />
                            {game.winner}
                          </span>
                        ) : game.players.map((p) => p.name).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="t-small text-[rgb(var(--ink-subtle))] shrink-0 font-num">{formatDate(game.createdAt)}</div>
                  <button
                    onClick={(e) => handleDelete(e, game.id)}
                    aria-label="Delete game"
                    className="tap text-[rgb(var(--ink-subtle))] hover:text-[rgb(var(--brand))] transition shrink-0 p-2 rounded-lg hover:bg-[rgb(var(--brand-soft))]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ────── Update log ────── */}
      <section className="surface-bone rounded-2xl border border-[rgb(var(--rule))] shadow-pip overflow-hidden">
        <UpdateLog />
      </section>

      {/* ────── Admin auth ────── */}
      <div className="text-center pt-2">
        {authUser && !authUser.isAnonymous ? (
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="t-small text-[rgb(var(--ink-subtle))]">
              <span className="font-medium text-[rgb(var(--ink-muted))]">{authUser.email}</span>
              {isSuperAdmin && <span className="ml-2 text-[rgb(var(--brand))] font-bold">· Super Admin</span>}
            </span>
            <button onClick={onSignOut} className="tap t-small text-[rgb(var(--brand))] hover:underline transition font-semibold">
              Sign out
            </button>
          </div>
        ) : showAdminLogin ? (
          <div className="surface-bone border border-[rgb(var(--rule))] rounded-2xl p-5 shadow-pip text-left max-w-sm mx-auto scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="t-h2 text-[rgb(var(--ink))]" style={{ fontSize: 15 }}>Admin sign in</h3>
              <button onClick={() => { setShowAdminLogin(false); setLoginError(''); }} aria-label="Close"
                className="tap text-[rgb(var(--ink-subtle))] hover:text-[rgb(var(--ink))] transition p-1 rounded-lg hover:bg-[rgb(var(--rule-soft))]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
                className="tap w-full px-3 border border-[rgb(var(--rule))] rounded-xl t-body focus:border-brand outline-none surface-paper text-[rgb(var(--ink))] placeholder-[rgb(var(--ink-subtle))] transition"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete="current-password"
                className="tap w-full px-3 border border-[rgb(var(--rule))] rounded-xl t-body focus:border-brand outline-none surface-paper text-[rgb(var(--ink))] placeholder-[rgb(var(--ink-subtle))] transition"
              />
              {loginError && <p className="t-small text-[rgb(var(--brand))]">{loginError}</p>}
              <button
                type="submit"
                disabled={loginLoading}
                className="tap w-full fill-brand t-body font-bold py-3 rounded-xl hover:opacity-95 transition disabled:opacity-50 shadow-pip-brand"
              >
                {loginLoading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowAdminLogin(true)}
            className="tap t-micro text-[rgb(var(--ink-subtle))] hover:text-[rgb(var(--ink-muted))] transition px-3"
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
