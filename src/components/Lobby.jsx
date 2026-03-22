import { useState, useEffect } from 'react';
import { db, collection, getDocs } from '../lib/firebase';

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

export default function Lobby({ onCreateGame, onJoinGame, isLoading }) {
  const [joinId, setJoinId] = useState('');
  const [allGames, setAllGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);

  useEffect(() => {
    getDocs(collection(db, 'dominoGames'))
      .then((snapshot) => {
        const games = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          games.push({
            id: doc.id,
            players: data.players || [],
            rounds: data.rounds || [],
            createdAt: data.createdAt,
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
  }, []);

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

      {/* All games list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">All Games</h3>
        </div>
        {loadingGames ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading games...</div>
        ) : allGames.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No games yet. Create one to get started!
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {allGames.map((game) => (
              <button
                key={game.id}
                onClick={() => onJoinGame(game.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-indigo-50 active:bg-indigo-100 transition text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                  {game.rounds.length}R
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-600 tracking-wider text-sm">
                      {game.id}
                    </span>
                    {game.players.length > 0 && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {game.players.length} player{game.players.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {game.players.length > 0 && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {game.players.map((p) => p.name).join(', ')}
                    </p>
                  )}
                </div>
                <div className="text-xs text-gray-400 shrink-0">
                  {formatDate(game.createdAt)}
                </div>
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
