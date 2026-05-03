import { useState } from 'react';
import { db, doc, updateDoc, arrayUnion } from '../lib/firebase';

export default function PlayerClaimScreen({ gameId, gameData, isHost, onClaim, onSkip }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const players = gameData?.players || [];
  const claims = gameData?.deviceClaims || {};

  const isRecentlyClaimed = (playerId) => {
    const claim = claims[playerId];
    if (!claim?.claimedAt) return false;
    const claimedAt = claim.claimedAt?.toDate?.() || new Date(claim.claimedAt);
    return Date.now() - claimedAt.getTime() < 10 * 60 * 1000; // 10 min
  };

  const handleAddAndClaim = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    const player = { id: Date.now().toString(), name: newName.trim() };
    await updateDoc(doc(db, 'dominoGames', gameId), {
      players: arrayUnion(player),
    });
    onClaim(player);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-lg font-extrabold text-gray-800 dark:text-gray-100">Who are you?</h2>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Select your name to track your score</p>
      </div>

      <div className="p-4 space-y-2">
        {players.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
            {isHost
              ? 'No players yet — add your name below to get started.'
              : 'The host is still setting up the game. Check back in a moment, or add your name below.'}
          </p>
        )}

        {players.map((player) => {
          const claimed = isRecentlyClaimed(player.id);
          return (
            <button
              key={player.id}
              onClick={() => !claimed && onClaim(player)}
              disabled={claimed}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition ${
                claimed
                  ? 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-default'
                  : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 active:scale-[0.98]'
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                claimed
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                  : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400'
              }`}>
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">{player.name}</p>
                {claimed && <p className="text-xs text-gray-400 dark:text-gray-500">Already joined on another device</p>}
              </div>
              {!claimed && (
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          );
        })}

        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition text-left"
          >
            <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm font-medium">I'm not listed — add me</span>
          </button>
        ) : (
          <form onSubmit={handleAddAndClaim} className="flex gap-2 pt-1">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Your name..."
              className="flex-1 min-w-0 p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <button type="submit" disabled={!newName.trim() || saving}
              className="bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 shrink-0 text-sm">
              Join
            </button>
            <button type="button" onClick={() => setAdding(false)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 py-2.5 px-2 text-sm transition">
              Cancel
            </button>
          </form>
        )}
      </div>

      <div className="px-4 pb-4">
        <button onClick={onSkip} className="w-full text-xs text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 py-2 transition">
          Skip — manage all scores manually
        </button>
      </div>
    </div>
  );
}
