import { useState, useEffect } from 'react';
import { db, auth, collection, getDocs, doc, deleteDoc, signInWithEmailAndPassword } from '../lib/firebase';
import { LockIcon } from './Icons';

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

  // Only fetch all games when super admin is confirmed
  useEffect(() => {
    if (isSuperAdmin) loadGames();
    else setAllGames([]);
  }, [isSuperAdmin]);

  const handleDelete = async (e, gameId) => {
    e.stopPropagation();
    if (!confirm(`Delete game ${gameId}? This cannot be undone.`)) return;
    await deleteDoc(doc(db, 'dominoGames', gameId));
    setAllGames((prev) => prev.filter((g) => g.id !== gameId));
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
      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-1">New Game</h2>
          <p className="text-sm text-gray-500 mb-4">Start a fresh scoreboard.</p>
          <button
            onClick={onCreateGame}
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50"
          >
            Create Game
          </button>
        </div>
        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Join Game</h2>
          <p className="text-sm text-gray-500 mb-4">Enter a 6-character Game ID.</p>
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
              className="flex-1 min-w-0 p-2.5 text-center font-mono tracking-widest uppercase border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !joinId.trim()}
              className="bg-gray-800 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-gray-900 active:bg-black transition disabled:opacity-50 shrink-0"
            >
              Join
            </button>
          </form>
        </div>
      </div>

      {/* Super admin: all games list */}
      {isSuperAdmin && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-800">All Games</h3>
              <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">Admin</span>
            </div>
            <button onClick={loadGames} className="text-xs text-gray-400 hover:text-indigo-600 transition font-medium">
              Refresh
            </button>
          </div>
          {loadingGames ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading games...</div>
          ) : allGames.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No games yet. Create one to get started!</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {allGames.map((game) => (
                <div
                  key={game.id}
                  onClick={() => onJoinGame(game.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-indigo-50 active:bg-indigo-100 transition text-left cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                    game.finished ? 'bg-yellow-100 text-yellow-700' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    {game.finished ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-1.17a3 3 0 01-1.83 1.83V14h1a2 2 0 110 4H6a2 2 0 110-4h1v-2.17A3 3 0 015.17 10H4a2 2 0 110-4h1.17A3 3 0 015 5z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span>{game.rounds.length}R</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-600 tracking-wider text-sm">{game.id}</span>
                      {game.finished && (
                        <span className="text-xs text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                          <LockIcon className="w-3 h-3" />
                          Finished
                        </span>
                      )}
                      {game.players.length > 0 && !game.finished && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          {game.players.length} player{game.players.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {game.players.length > 0 && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {game.winner ? `Winner: ${game.winner}` : game.players.map((p) => p.name).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 shrink-0">{formatDate(game.createdAt)}</div>
                  <button
                    onClick={(e) => handleDelete(e, game.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0 p-1.5 rounded-lg hover:bg-red-50"
                    title="Delete game"
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

      {/* Admin auth footer */}
      <div className="text-center">
        {authUser && !authUser.isAnonymous ? (
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs text-gray-400">
              Signed in as <span className="font-medium text-gray-600">{authUser.email}</span>
              {isSuperAdmin && <span className="ml-1 text-indigo-500 font-semibold">· Super Admin</span>}
            </span>
            <button onClick={onSignOut} className="text-xs text-red-400 hover:text-red-600 transition font-medium">
              Sign out
            </button>
          </div>
        ) : showAdminLogin ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm text-left max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-sm">Admin Sign In</h3>
              <button onClick={() => { setShowAdminLogin(false); setLoginError(''); }} className="text-gray-400 hover:text-gray-600 transition">
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
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete="current-password"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              {loginError && <p className="text-xs text-red-600">{loginError}</p>}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm"
              >
                {loginLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowAdminLogin(true)}
            className="text-xs text-gray-300 hover:text-gray-500 transition"
          >
            Admin
          </button>
        )}
      </div>
    </div>
  );
}
