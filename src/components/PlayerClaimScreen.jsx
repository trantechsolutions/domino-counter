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
    <section className="surface-bone rounded-3xl border-2 border-[rgb(var(--rule))] shadow-pip-lg overflow-hidden">
      <header className="px-5 py-5 border-b border-[rgb(var(--rule-soft))]">
        <p className="t-micro text-[rgb(var(--ink-subtle))]">Identify yourself</p>
        <h2 className="t-h2 text-[rgb(var(--ink))] mt-1">Who are you?</h2>
        <p className="t-small text-[rgb(var(--ink-muted))] mt-1">Select your name to track your score.</p>
      </header>

      <div className="p-4 space-y-2">
        {players.length === 0 && (
          <p className="t-body text-[rgb(var(--ink-subtle))] text-center py-8">
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
              className={`tap w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition ${
                claimed
                  ? 'border-[rgb(var(--rule-soft))] opacity-50 cursor-default'
                  : 'border-[rgb(var(--rule))] hover:border-brand hover:bg-[rgb(var(--brand-soft))] active:scale-[0.99]'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-num text-base font-bold shrink-0 ${
                claimed
                  ? 'surface-paper border border-[rgb(var(--rule))] text-[rgb(var(--ink-subtle))]'
                  : 'fill-brand shadow-pip-brand'
              }`}>
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="t-body font-semibold text-[rgb(var(--ink))] truncate">{player.name}</p>
                {claimed && <p className="t-small text-[rgb(var(--ink-subtle))]">Joined on another device</p>}
              </div>
              {!claimed && (
                <svg className="w-4 h-4 text-[rgb(var(--ink-subtle))] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          );
        })}

        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="tap w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-[rgb(var(--rule))] text-[rgb(var(--ink-muted))] hover:border-brand hover:text-[rgb(var(--brand))] transition text-left"
          >
            <div className="w-10 h-10 rounded-xl surface-paper border border-[rgb(var(--rule))] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="t-body font-medium">I'm not listed — add me</span>
          </button>
        ) : (
          <form onSubmit={handleAddAndClaim} className="flex gap-2 pt-1">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Your name…"
              className="tap flex-1 min-w-0 px-3 border border-[rgb(var(--rule))] rounded-xl focus:border-brand outline-none t-body surface-paper text-[rgb(var(--ink))] placeholder-[rgb(var(--ink-subtle))] transition"
            />
            <button type="submit" disabled={!newName.trim() || saving}
              className="tap fill-brand t-body font-bold px-4 rounded-xl transition disabled:opacity-50 shrink-0 shadow-pip-brand">
              Join
            </button>
            <button type="button" onClick={() => setAdding(false)}
              className="tap text-[rgb(var(--ink-subtle))] hover:text-[rgb(var(--ink))] px-2 t-small transition">
              Cancel
            </button>
          </form>
        )}
      </div>

      <div className="px-4 pb-4">
        <button onClick={onSkip} className="tap w-full t-small text-[rgb(var(--ink-subtle))] hover:text-[rgb(var(--ink-muted))] py-2 transition">
          Skip — manage scores manually
        </button>
      </div>
    </section>
  );
}
