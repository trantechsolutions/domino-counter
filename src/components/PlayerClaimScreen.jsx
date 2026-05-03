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
    return Date.now() - claimedAt.getTime() < 10 * 60 * 1000;
  };

  const handleAddAndClaim = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    const player = { id: Date.now().toString(), name: newName.trim() };
    await updateDoc(doc(db, 'dominoGames', gameId), { players: arrayUnion(player) });
    onClaim(player);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">Who are you?</h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Select your name to track your score</p>
      </div>

      <div className="p-4 space-y-2">
        {players.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
            {isHost
              ? 'No players yet — add your name below to get started.'
              : 'The host is setting up the game. Check back in a moment, or add your name below.'}
          </p>
        )}

        {players.map((player) => {
          const claimed = isRecentlyClaimed(player.id);
          return (
            <button
              key={player.id}
              onClick={() => !claimed && onClaim(player)}
              disabled={claimed}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition ${
                claimed
                  ? 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 opacity-50 cursor-default'
                  : 'border-slate-200 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/15 active:scale-[0.99]'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                claimed
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                  : 'grad-brand text-white shadow-sm shadow-violet-400/20'
              }`}>
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{player.name}</p>
                {claimed && <p className="text-xs text-slate-400 dark:text-slate-500">Joined on another device</p>}
              </div>
              {!claimed && (
                <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          );
        })}

        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-violet-300 dark:hover:border-violet-700 hover:text-violet-500 dark:hover:text-violet-400 transition text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
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
              className="flex-1 min-w-0 px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition"
            />
            <button type="submit" disabled={!newName.trim() || saving}
              className="grad-brand text-white font-semibold py-2.5 px-4 rounded-xl hover:opacity-90 transition disabled:opacity-50 shrink-0 text-sm shadow-sm shadow-violet-500/20">
              Join
            </button>
            <button type="button" onClick={() => setAdding(false)}
              className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 py-2.5 px-2 text-sm transition">
              Cancel
            </button>
          </form>
        )}
      </div>

      <div className="px-4 pb-4">
        <button onClick={onSkip} className="w-full text-xs text-slate-300 dark:text-slate-700 hover:text-slate-500 dark:hover:text-slate-400 py-2 transition">
          Skip — manage scores manually
        </button>
      </div>
    </div>
  );
}
