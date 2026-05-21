import { useState, useMemo } from 'react';
import { db, doc, updateDoc, arrayUnion, deleteDoc } from '../lib/firebase';
import { PlayerIcon, MedalIcon, CrownIcon, LockIcon, PipLoader } from './Icons';
import { getDeviceId } from '../lib/deviceId';
import ScoreEntryModal from './ScoreEntryModal';
import ConfirmDialog from './ConfirmDialog';

const roundLabel = (roundIndex) => `R${12 - roundIndex}`;

export default function Scoreboard({ gameId, gameData, onLeaveGame, myPlayer, isHost, onPendingScoreWrite, onSubmitScores }) {
  const [newPlayer, setNewPlayer] = useState('');
  const [editingName, setEditingName] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingScore, setEditingScore] = useState(null);
  const [editScoreValue, setEditScoreValue] = useState('');
  const [scoreModal, setScoreModal] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const isFinished = gameData?.finished || false;

  const rankedPlayers = useMemo(() => {
    if (!gameData?.players) return [];
    const totals = gameData.players.map((player) => {
      const totalScore = gameData.rounds.reduce((acc, round) => acc + (round.scores[player.id] || 0), 0);
      return { ...player, totalScore };
    });
    totals.sort((a, b) => a.totalScore - b.totalScore);
    let rank = 1;
    return totals.map((player, index) => {
      if (index > 0 && player.totalScore > totals[index - 1].totalScore) rank = index + 1;
      return { ...player, rank };
    });
  }, [gameData]);

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!newPlayer.trim()) return;
    const player = { id: Date.now().toString(), name: newPlayer.trim() };
    await updateDoc(doc(db, 'dominoGames', gameId), { players: arrayUnion(player) });
    setNewPlayer('');
  };

  const startEditName = (player) => {
    if (isFinished) return;
    setEditingName(player.id);
    setEditNameValue(player.name);
  };

  const saveEditName = async () => {
    if (!editNameValue.trim() || !editingName) { setEditingName(null); return; }
    const updatedPlayers = gameData.players.map((p) => p.id === editingName ? { ...p, name: editNameValue.trim() } : p);
    await updateDoc(doc(db, 'dominoGames', gameId), { players: updatedPlayers });
    setEditingName(null);
  };

  const startEditScore = (roundIndex, playerId, currentValue) => {
    if (isFinished) return;
    setEditingScore({ roundIndex, playerId });
    setEditScoreValue(String(currentValue ?? 0));
  };

  const saveEditScore = async () => {
    if (!editingScore) return;
    const { roundIndex, playerId } = editingScore;
    const parsed = parseInt(editScoreValue, 10);
    if (isNaN(parsed)) { setEditingScore(null); return; }
    const updatedRounds = gameData.rounds.map((r, i) => i !== roundIndex ? r : { ...r, scores: { ...r.scores, [playerId]: parsed } });
    await updateDoc(doc(db, 'dominoGames', gameId), { rounds: updatedRounds });
    setEditingScore(null);
  };

  const handleEndGame = () => {
    if (rankedPlayers.length === 0) return;
    const winnerName = rankedPlayers[0].name;
    setConfirmDialog({
      title: 'End game',
      message: `Crown ${winnerName} as the winner? This locks the scoreboard.`,
      confirmLabel: 'End game',
      variant: 'brand',
      onConfirm: async () => {
        setConfirmDialog(null);
        await updateDoc(doc(db, 'dominoGames', gameId), { finished: true, winner: winnerName, finishedAt: new Date() });
      },
    });
  };

  const handleReopenGame = async () => {
    await updateDoc(doc(db, 'dominoGames', gameId), { finished: false, winner: null, finishedAt: null });
  };

  const handleDeleteGame = () => {
    setConfirmDialog({
      title: 'Delete game',
      message: `Delete game ${gameId}? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        await deleteDoc(doc(db, 'dominoGames', gameId));
        onLeaveGame();
      },
    });
  };

  if (!gameData) {
    return <div className="flex justify-center p-10"><PipLoader /></div>;
  }

  return (
    <div className="space-y-4">
      {/* ────── Claim Host ────── */}
      {!isHost && (
        <button
          onClick={() => setConfirmDialog({
            title: 'Claim host',
            message: 'Take host control on this device? You will be able to submit rounds and manage the game.',
            confirmLabel: 'Claim host',
            variant: 'brand',
            onConfirm: () => {
              setConfirmDialog(null);
              updateDoc(doc(db, 'dominoGames', gameId), { hostDeviceId: getDeviceId() });
            },
          })}
          className="tap w-full flex items-center justify-between surface-bone border border-[rgb(var(--rule))] hover:border-brand text-[rgb(var(--ink-muted))] hover:text-[rgb(var(--brand))] px-4 py-3 rounded-2xl transition-colors t-small font-semibold"
        >
          <span className="flex items-center gap-2">
            <span className="pip pip-brand" />
            Claim host
          </span>
          <span className="t-micro text-[rgb(var(--ink-subtle))] font-medium normal-case tracking-normal">Manage &amp; submit rounds</span>
        </button>
      )}

      {/* ────── Winner banner ────── */}
      {isFinished && (
        <div className="relative overflow-hidden tile p-6 text-center win-stamp" style={{ background: 'rgb(var(--bone-raised))' }}>
          <CrownIcon className="w-9 h-9 text-[rgb(var(--brand))] mx-auto mb-3" />
          <p className="t-micro text-[rgb(var(--ink-subtle))] mb-1">Winner</p>
          <h2 className="t-h1 text-[rgb(var(--ink))]">{gameData.winner}</h2>
          <p className="t-small text-[rgb(var(--ink-subtle))] mt-2 flex items-center justify-center gap-1.5">
            <LockIcon className="w-3 h-3" /> Game finished
          </p>
        </div>
      )}

      {/* ────── Game header (dense chrome) ────── */}
      <div className="surface-bone border border-[rgb(var(--rule))] rounded-xl px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="t-micro text-[rgb(var(--ink-subtle))]">Game</span>
          <span className="font-num font-bold text-[rgb(var(--brand))] tracking-[0.18em] text-sm">{gameId}</span>
          {isFinished && <LockIcon className="text-[rgb(var(--warning))] w-3 h-3 shrink-0" />}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {isFinished ? (
            <button onClick={handleReopenGame}
              className="tap t-small text-[rgb(var(--ink-muted))] font-semibold px-3 rounded-lg hover:bg-[rgb(var(--rule-soft))] hover:text-[rgb(var(--brand))] transition">
              Reopen
            </button>
          ) : rankedPlayers.length > 0 && gameData.rounds.length > 0 ? (
            <button onClick={handleEndGame}
              className="tap t-small text-[rgb(var(--ink-muted))] font-semibold px-3 rounded-lg hover:bg-[rgb(var(--rule-soft))] hover:text-[rgb(var(--brand))] transition flex items-center gap-1.5">
              <CrownIcon className="w-3.5 h-3.5" /> End
            </button>
          ) : null}
          <button onClick={handleDeleteGame} aria-label="Delete game"
            className="tap text-[rgb(var(--ink-subtle))] hover:text-[rgb(var(--brand))] p-2 rounded-lg hover:bg-[rgb(var(--rule-soft))] transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button onClick={onLeaveGame}
            className="tap t-small text-[rgb(var(--ink-muted))] font-semibold px-3 rounded-lg hover:bg-[rgb(var(--rule-soft))] transition">
            Leave
          </button>
        </div>
      </div>

      {/* ────── Add player (host) ────── */}
      {!isFinished && isHost && (
        <form onSubmit={handleAddPlayer} className="flex gap-2">
          <input
            type="text"
            value={newPlayer}
            onChange={(e) => setNewPlayer(e.target.value)}
            placeholder="Add player…"
            className="flex-1 min-w-0 px-4 py-3 surface-bone border border-[rgb(var(--rule))] rounded-xl focus:border-brand outline-none t-body text-[rgb(var(--ink))] placeholder-[rgb(var(--ink-subtle))] transition"
          />
          <button type="submit" disabled={!newPlayer.trim()}
            className="tap fill-brand t-body font-semibold px-5 rounded-xl transition disabled:opacity-40 shrink-0 shadow-pip-brand">
            Add
          </button>
        </form>
      )}

      {/* ════════════════════════════════════════════════════════════
          THE SCOREBOARD — dominant element. Larger radius, hue-shifted
          shadow, distinctive border treatment. No divide-y; alignment
          and padding carry the row separation.
          ════════════════════════════════════════════════════════════ */}
      {rankedPlayers.length > 0 && (
        <section
          aria-label="Scoreboard"
          className="surface-bone rounded-3xl border-2 border-[rgb(var(--rule))] shadow-pip-lg overflow-hidden"
        >
          <header className="px-5 pt-5 pb-3 flex items-end justify-between">
            <div>
              <p className="t-micro text-[rgb(var(--ink-subtle))]">Scoreboard</p>
              <h2 className="t-h2 text-[rgb(var(--ink))] mt-1">
                {gameData.rounds.length === 0 ? 'Round one' : `${gameData.rounds.length} round${gameData.rounds.length === 1 ? '' : 's'} played`}
              </h2>
            </div>
            <p className="t-micro text-[rgb(var(--ink-subtle))]">
              {rankedPlayers.length} player{rankedPlayers.length === 1 ? '' : 's'}
            </p>
          </header>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[rgb(var(--ink-subtle))]">
                  <th className="t-micro py-2 px-3 text-center font-bold w-8">#</th>
                  <th className="t-micro py-2 px-2 text-left font-bold sticky left-0 surface-bone z-10">Player</th>
                  {gameData.rounds.map((r, ri) => (
                    <th key={r.roundNumber} className="t-micro py-2 px-2 text-center font-bold whitespace-nowrap font-num">
                      {roundLabel(ri)}
                    </th>
                  ))}
                  <th className="t-micro py-2 px-4 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {rankedPlayers.map((player) => (
                  <tr key={player.id} className={`${
                    isFinished && player.rank === 1 ? 'bg-[rgb(var(--brand-soft))]' : ''
                  }`}>
                    <td className="py-4 px-3 text-center">
                      {player.rank === 1 ? (
                        isFinished
                          ? <CrownIcon className="text-[rgb(var(--brand))] mx-auto" />
                          : <MedalIcon className="text-[rgb(var(--brand))] mx-auto w-4 h-4" />
                      ) : (
                        <span className="font-num text-[rgb(var(--ink-subtle))] font-bold text-xs">{player.rank}</span>
                      )}
                    </td>
                    <td className="py-4 px-2 sticky left-0 bg-inherit z-10">
                      {editingName === player.id ? (
                        <input
                          autoFocus
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          onBlur={saveEditName}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditName();
                            if (e.key === 'Escape') setEditingName(null);
                          }}
                          className="w-full px-2 py-1.5 border-2 border-brand rounded-lg t-body outline-none surface-bone text-[rgb(var(--ink))]"
                        />
                      ) : (
                        <button
                          onClick={() => startEditName(player)}
                          disabled={isFinished}
                          className={`tap flex items-center gap-2 group text-left ${
                            isFinished ? 'cursor-default' : ''
                          }`}
                        >
                          <PlayerIcon />
                          <span className={`t-body font-semibold ${
                            isFinished && player.rank === 1
                              ? 'text-[rgb(var(--brand))]'
                              : 'text-[rgb(var(--ink))]'
                          }`}>
                            {player.name}
                          </span>
                        </button>
                      )}
                    </td>
                    {gameData.rounds.map((r, ri) => (
                      <td key={r.roundNumber} className="py-4 px-1 text-center">
                        {editingScore?.roundIndex === ri && editingScore?.playerId === player.id ? (
                          <input
                            autoFocus
                            type="number"
                            value={editScoreValue}
                            onChange={(e) => setEditScoreValue(e.target.value)}
                            onBlur={saveEditScore}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditScore();
                              if (e.key === 'Escape') setEditingScore(null);
                            }}
                            className="w-14 px-1 py-1 border-2 border-brand rounded-lg text-center t-small outline-none surface-bone text-[rgb(var(--ink))] font-num"
                          />
                        ) : (
                          <button
                            onClick={() => startEditScore(ri, player.id, r.scores[player.id])}
                            disabled={isFinished}
                            className={`font-num t-small font-medium tabular-nums px-2 py-1 rounded-md min-w-[2.25rem] ${
                              isFinished
                                ? 'text-[rgb(var(--ink-muted))] cursor-default'
                                : 'text-[rgb(var(--ink-muted))] hover:text-[rgb(var(--brand))] hover:bg-[rgb(var(--rule-soft))]'
                            }`}
                          >
                            {r.scores[player.id] ?? 0}
                          </button>
                        )}
                      </td>
                    ))}
                    <td className={`py-4 px-4 text-right ${
                      isFinished && player.rank === 1
                        ? 'text-[rgb(var(--brand))]'
                        : player.rank === 1
                        ? 'text-[rgb(var(--brand))]'
                        : 'text-[rgb(var(--ink))]'
                    }`}>
                      <span className="font-num n-total">{player.totalScore}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ────── Score entry ────── */}
      {!isFinished && gameData.players.length > 0 && (() => {
        const pending = gameData.pendingScores || {};
        const enteredCount = gameData.players.filter(p => pending[p.id] !== undefined).length;
        const allEntered = enteredCount === gameData.players.length;

        if (isHost) {
          return (
            <section className="surface-bone p-5 rounded-2xl border border-[rgb(var(--rule))] shadow-pip">
              <header className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="t-micro text-[rgb(var(--ink-subtle))]">Next</span>
                  <span className="font-num font-bold text-[rgb(var(--brand))] text-sm tracking-wider">
                    {roundLabel(gameData.rounds.length)}
                  </span>
                </div>
                <span className="font-num t-small text-[rgb(var(--ink-subtle))]">
                  {enteredCount} / {gameData.players.length}
                </span>
              </header>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gameData.players.map((player) => {
                  const val = pending[player.id];
                  const hasScore = val !== undefined && val !== null;
                  return (
                    <button key={player.id} onClick={() => setScoreModal({ player })}
                      className={`tap w-full p-4 rounded-2xl border-2 text-left transition active:scale-[0.98] ${
                        hasScore
                          ? 'border-[rgb(var(--success))] bg-[rgba(34,120,80,0.08)]'
                          : 'border-[rgb(var(--rule))] hover:border-brand hover:bg-[rgb(var(--brand-soft))]'
                      }`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        {hasScore ? (
                          <span className="pip pulse-dot shrink-0" style={{ background: 'rgb(var(--success))' }} />
                        ) : (
                          <span className="pip shrink-0" style={{ background: 'rgb(var(--rule))' }} />
                        )}
                        <p className="t-small font-semibold text-[rgb(var(--ink-muted))] truncate">{player.name}</p>
                      </div>
                      <p className={`font-num n-score ${
                        hasScore ? 'text-[rgb(var(--success))]' : 'text-[rgb(var(--ink-subtle))] opacity-50'
                      }`}>
                        {hasScore ? val : '—'}
                      </p>
                    </button>
                  );
                })}
              </div>
              <button onClick={onSubmitScores} disabled={!allEntered}
                className={`tap w-full mt-4 t-body font-bold py-3.5 rounded-2xl transition ${
                  allEntered
                    ? 'fill-brand shadow-pip-brand'
                    : 'bg-[rgb(var(--rule-soft))] text-[rgb(var(--ink-subtle))] cursor-not-allowed'
                }`}>
                {allEntered ? 'Submit round' : `Waiting for ${gameData.players.length - enteredCount} more…`}
              </button>
            </section>
          );
        }

        const myEntry = myPlayer ? pending[myPlayer.id] : undefined;
        const hasMyScore = myEntry !== undefined && myEntry !== null;
        return (
          <div className="space-y-4">
            {myPlayer ? (
              <section className="surface-bone p-5 rounded-2xl border border-[rgb(var(--rule))] shadow-pip">
                <header className="flex items-center gap-2 mb-4">
                  <span className="t-micro text-[rgb(var(--ink-subtle))]">Round</span>
                  <span className="font-num font-bold text-[rgb(var(--brand))] text-sm tracking-wider">
                    {roundLabel(gameData.rounds.length)}
                  </span>
                  <span className="t-small text-[rgb(var(--ink-subtle))] ml-auto">Your score</span>
                </header>
                {hasMyScore ? (
                  <div className="flex items-center gap-4 p-4 rounded-2xl border-2 border-[rgb(var(--success))] bg-[rgba(34,120,80,0.08)]">
                    <div className="flex-1">
                      <p className="t-small font-medium text-[rgb(var(--ink-muted))]">{myPlayer.name}</p>
                      <p className="font-num n-mega text-[rgb(var(--success))]">{myEntry}</p>
                    </div>
                    <button onClick={() => setScoreModal({ player: myPlayer })}
                      className="tap t-small font-semibold text-[rgb(var(--success))] px-4 rounded-xl hover:bg-[rgba(34,120,80,0.12)]">
                      Edit
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setScoreModal({ player: myPlayer })}
                    className="tap w-full p-6 rounded-2xl border-2 border-dashed border-brand bg-[rgb(var(--brand-soft))] hover:bg-[rgb(var(--brand-soft))] transition text-center active:scale-[0.99]">
                    <p className="t-body font-bold text-[rgb(var(--brand))]">Tap to enter your score</p>
                    <p className="t-small text-[rgb(var(--ink-muted))] mt-1">Scan dominoes or type manually</p>
                  </button>
                )}
              </section>
            ) : null}

            <section className="surface-bone p-5 rounded-2xl border border-[rgb(var(--rule))] shadow-pip">
              <p className="t-micro text-[rgb(var(--ink-subtle))] mb-3">Table status</p>
              <div className="flex flex-wrap gap-2">
                {gameData.players.map((player) => {
                  const entered = pending[player.id] !== undefined;
                  return (
                    <div key={player.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full t-small font-medium border ${
                      entered
                        ? 'bg-[rgba(34,120,80,0.08)] border-[rgb(var(--success))] text-[rgb(var(--success))]'
                        : 'surface-paper border-[rgb(var(--rule))] text-[rgb(var(--ink-subtle))]'
                    }`}>
                      <span className={`pip shrink-0 ${entered ? 'pulse-dot' : ''}`} style={{
                        background: entered ? 'rgb(var(--success))' : 'rgb(var(--rule))'
                      }} />
                      {player.name}
                    </div>
                  );
                })}
              </div>
              {allEntered ? (
                <p className="t-small text-[rgb(var(--success))] font-semibold mt-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  All scores entered — waiting for host to submit
                </p>
              ) : (
                <p className="t-small text-[rgb(var(--ink-subtle))] mt-3">
                  Waiting for {gameData.players.length - enteredCount} more player{gameData.players.length - enteredCount !== 1 ? 's' : ''}…
                </p>
              )}
            </section>
          </div>
        );
      })()}

      {scoreModal && (
        <ScoreEntryModal
          player={scoreModal.player}
          pendingWinner={gameData.pendingWinner}
          onConfirm={(value, isWinner = false) => {
            onPendingScoreWrite(scoreModal.player.id, value, isWinner);
            setScoreModal(null);
          }}
          onCancel={() => setScoreModal(null)}
        />
      )}

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
