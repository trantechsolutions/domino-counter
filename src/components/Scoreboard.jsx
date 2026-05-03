import { useState, useMemo } from 'react';
import { db, doc, updateDoc, arrayUnion, deleteDoc } from '../lib/firebase';
import { PlayerIcon, GoldMedalIcon, TrophyIcon, LockIcon } from './Icons';
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
      title: 'End Game',
      message: `Crown ${winnerName} as the winner? This will lock the scoreboard.`,
      confirmLabel: 'End Game',
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
      title: 'Delete Game',
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
    return (
      <div className="flex justify-center p-10">
        <div className="w-6 h-6 rounded-full border-2 border-violet-400 border-t-transparent" style={{ animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Claim Host banner */}
      {!isHost && (
        <button
          onClick={() => setConfirmDialog({
            title: 'Claim Host',
            message: 'Take host control on this device? You will be able to submit rounds and manage the game.',
            confirmLabel: 'Claim Host',
            variant: 'brand',
            onConfirm: () => {
              setConfirmDialog(null);
              updateDoc(doc(db, 'dominoGames', gameId), { hostDeviceId: getDeviceId() });
            },
          })}
          className="w-full flex items-center justify-between bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/60 text-violet-700 dark:text-violet-400 font-semibold px-4 py-3 rounded-2xl hover:bg-violet-100 dark:hover:bg-violet-900/30 active:bg-violet-200 transition text-sm"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Claim Host
          </span>
          <span className="text-xs font-normal text-violet-400 dark:text-violet-500">Tap to manage &amp; submit rounds</span>
        </button>
      )}

      {/* Winner banner */}
      {isFinished && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-800/60 p-5 rounded-2xl text-center">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-yellow-400/10 rounded-full blur-2xl" />
          </div>
          <TrophyIcon className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h2 className="text-base font-extrabold text-amber-800 dark:text-amber-300 tracking-tight">{gameData.winner} wins!</h2>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 flex items-center justify-center gap-1">
            <LockIcon className="w-3 h-3" /> Game finished
          </p>
        </div>
      )}

      {/* Game header */}
      <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grad-brand w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm shadow-violet-500/20">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="2" y="2" width="9" height="20" rx="2" />
              <rect x="13" y="2" width="9" height="20" rx="2" />
            </svg>
          </div>
          <span className="font-mono font-bold text-violet-600 dark:text-violet-400 tracking-[0.2em] text-sm">{gameId}</span>
          {isFinished && <LockIcon className="text-amber-500 w-3.5 h-3.5 shrink-0" />}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isFinished ? (
            <button onClick={handleReopenGame}
              className="text-xs text-violet-600 dark:text-violet-400 font-semibold py-1.5 px-3 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/30 transition">
              Reopen
            </button>
          ) : rankedPlayers.length > 0 && gameData.rounds.length > 0 ? (
            <button onClick={handleEndGame}
              className="text-xs text-amber-700 dark:text-amber-500 font-semibold py-1.5 px-3 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition flex items-center gap-1">
              <TrophyIcon className="w-3.5 h-3.5" /> End
            </button>
          ) : null}
          <button onClick={handleDeleteGame} aria-label="Delete game"
            className="text-slate-400 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button onClick={onLeaveGame}
            className="text-xs text-slate-500 dark:text-slate-400 font-semibold py-1.5 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Leave
          </button>
        </div>
      </div>

      {/* Add player — host only */}
      {!isFinished && isHost && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <form onSubmit={handleAddPlayer} className="flex gap-2">
            <input
              type="text"
              value={newPlayer}
              onChange={(e) => setNewPlayer(e.target.value)}
              placeholder="Add player..."
              className="flex-1 min-w-0 px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition"
            />
            <button type="submit" disabled={!newPlayer.trim()}
              className="grad-brand text-white text-sm font-semibold py-2.5 px-4 rounded-xl hover:opacity-90 transition disabled:opacity-50 shrink-0 shadow-sm shadow-violet-500/20">
              Add
            </button>
          </form>
        </div>
      )}

      {/* Scoreboard table */}
      {rankedPlayers.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3 px-3 text-center font-semibold w-10">#</th>
                  <th className="py-3 px-3 text-left font-semibold">Player</th>
                  {gameData.rounds.map((r, ri) => (
                    <th key={r.roundNumber} className="py-3 px-2 text-center font-semibold whitespace-nowrap">
                      {roundLabel(ri)}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {rankedPlayers.map((player) => (
                  <tr key={player.id} className={`transition-colors ${
                    isFinished && player.rank === 1
                      ? 'bg-amber-50/60 dark:bg-amber-950/20'
                      : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                  }`}>
                    <td className="py-3 px-3 text-center">
                      {player.rank === 1 ? (
                        <span className="inline-flex justify-center">
                          {isFinished ? <TrophyIcon className="text-amber-500" /> : <GoldMedalIcon />}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-semibold text-xs">{player.rank}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
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
                          className="w-full px-2 py-1 border border-violet-400 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        />
                      ) : (
                        <button
                          onClick={() => startEditName(player)}
                          disabled={isFinished}
                          className={`flex items-center gap-1.5 transition-colors group text-left ${
                            isFinished ? 'cursor-default' : 'hover:text-violet-600 dark:hover:text-violet-400'
                          }`}
                        >
                          <PlayerIcon />
                          <span className={`font-medium text-sm ${
                            isFinished && player.rank === 1
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-800 dark:text-slate-100'
                          } ${!isFinished ? 'group-hover:text-violet-600 dark:group-hover:text-violet-400' : ''}`}>
                            {player.name}
                          </span>
                          {!isFinished && (
                            <svg className="w-3 h-3 text-slate-400 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </td>
                    {gameData.rounds.map((r, ri) => (
                      <td key={r.roundNumber} className="py-3 px-2 text-center">
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
                            className="w-14 px-1 py-1 border border-violet-400 rounded-lg text-center text-sm focus:ring-2 focus:ring-violet-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          />
                        ) : (
                          <button
                            onClick={() => startEditScore(ri, player.id, r.scores[player.id])}
                            disabled={isFinished}
                            className={`px-2 py-0.5 rounded-lg transition-colors min-w-[2rem] inline-block text-xs tabular-nums ${
                              isFinished
                                ? 'text-slate-500 dark:text-slate-400 cursor-default'
                                : 'text-slate-500 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'
                            }`}
                          >
                            {r.scores[player.id] ?? 0}
                          </button>
                        )}
                      </td>
                    ))}
                    <td className={`py-3 px-3 text-center font-bold text-sm tabular-nums ${
                      isFinished && player.rank === 1
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-violet-700 dark:text-violet-400'
                    }`}>
                      {player.totalScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Score entry */}
      {!isFinished && gameData.players.length > 0 && (() => {
        const pending = gameData.pendingScores || {};
        const enteredCount = gameData.players.filter(p => pending[p.id] !== undefined).length;
        const allEntered = enteredCount === gameData.players.length;

        if (isHost) {
          return (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Round</span>
                  <span className="text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 rounded-full">
                    {roundLabel(gameData.rounds.length)}
                  </span>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                  {enteredCount}/{gameData.players.length} entered
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {gameData.players.map((player) => {
                  const val = pending[player.id];
                  const hasScore = val !== undefined && val !== null;
                  return (
                    <button key={player.id} onClick={() => setScoreModal({ player })}
                      className={`w-full p-3 rounded-xl border-2 text-left transition active:scale-[0.97] ${
                        hasScore
                          ? 'border-emerald-400 dark:border-emerald-700/70 bg-emerald-50 dark:bg-emerald-950/30'
                          : 'border-slate-200 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/15'
                      }`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        {hasScore ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot shrink-0" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                        )}
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">{player.name}</p>
                      </div>
                      <p className={`text-2xl font-extrabold tabular-nums ${
                        hasScore ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-700'
                      }`}>
                        {hasScore ? val : '—'}
                      </p>
                    </button>
                  );
                })}
              </div>
              <button onClick={onSubmitScores} disabled={!allEntered}
                className={`w-full mt-3 font-semibold py-3 rounded-xl transition text-sm ${
                  allEntered
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}>
                {allEntered ? 'Submit Round' : `Waiting for ${gameData.players.length - enteredCount} more...`}
              </button>
            </div>
          );
        }

        const myEntry = myPlayer ? pending[myPlayer.id] : undefined;
        const hasMyScore = myEntry !== undefined && myEntry !== null;
        return (
          <div className="space-y-3">
            {myPlayer ? (
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Round</span>
                  <span className="text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 rounded-full">
                    {roundLabel(gameData.rounds.length)}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">— Your Score</span>
                </div>
                {hasMyScore ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-emerald-400 dark:border-emerald-700/70 bg-emerald-50 dark:bg-emerald-950/30">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{myPlayer.name}</p>
                      <p className="text-4xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">{myEntry}</p>
                    </div>
                    <button onClick={() => setScoreModal({ player: myPlayer })}
                      className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold hover:text-emerald-900 dark:hover:text-emerald-300 transition px-3 py-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
                      Edit
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setScoreModal({ player: myPlayer })}
                    className="w-full p-5 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 hover:bg-violet-100 dark:hover:bg-violet-900/25 transition text-center active:scale-[0.99]">
                    <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">Tap to enter your score</p>
                    <p className="text-xs text-violet-400 dark:text-violet-600 mt-0.5">Scan dominoes or enter manually</p>
                  </button>
                )}
              </div>
            ) : null}

            {/* Status */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-3">Table Status</p>
              <div className="flex flex-wrap gap-2.5">
                {gameData.players.map((player) => {
                  const entered = pending[player.id] !== undefined;
                  return (
                    <div key={player.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                      entered
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${entered ? 'bg-emerald-500 pulse-dot' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      {player.name}
                    </div>
                  );
                })}
              </div>
              {allEntered ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-3 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  All scores entered — waiting for host to submit
                </p>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                  Waiting for {gameData.players.length - enteredCount} more player{gameData.players.length - enteredCount !== 1 ? 's' : ''}...
                </p>
              )}
            </div>
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
