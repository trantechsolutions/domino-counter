import { useState, useMemo } from 'react';
import { db, doc, updateDoc, arrayUnion, deleteDoc } from '../lib/firebase';
import { PlayerIcon, GoldMedalIcon, TrophyIcon, LockIcon } from './Icons';
import { getDeviceId } from '../lib/deviceId';
import ScoreEntryModal from './ScoreEntryModal';

// Mexican Train: 13 rounds, starting at double-12 down to double-0
const roundLabel = (roundIndex) => `R${12 - roundIndex}`;

export default function Scoreboard({ gameId, gameData, onLeaveGame, myPlayer, isHost, onPendingScoreWrite, onSubmitScores }) {
  const [newPlayer, setNewPlayer] = useState('');
  const [editingName, setEditingName] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingScore, setEditingScore] = useState(null);
  const [editScoreValue, setEditScoreValue] = useState('');
  const [scoreModal, setScoreModal] = useState(null);

  const isFinished = gameData?.finished || false;

  const rankedPlayers = useMemo(() => {
    if (!gameData?.players) return [];
    const totals = gameData.players.map((player) => {
      const totalScore = gameData.rounds.reduce(
        (acc, round) => acc + (round.scores[player.id] || 0),
        0
      );
      return { ...player, totalScore };
    });
    totals.sort((a, b) => a.totalScore - b.totalScore);
    let rank = 1;
    return totals.map((player, index) => {
      if (index > 0 && player.totalScore > totals[index - 1].totalScore) {
        rank = index + 1;
      }
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
    const updatedPlayers = gameData.players.map((p) =>
      p.id === editingName ? { ...p, name: editNameValue.trim() } : p
    );
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
    const updatedRounds = gameData.rounds.map((r, i) =>
      i !== roundIndex ? r : { ...r, scores: { ...r.scores, [playerId]: parsed } }
    );
    await updateDoc(doc(db, 'dominoGames', gameId), { rounds: updatedRounds });
    setEditingScore(null);
  };

  const handleEndGame = async () => {
    if (rankedPlayers.length === 0) return;
    const winnerName = rankedPlayers[0].name;
    if (!confirm(`End game and crown ${winnerName} as the winner?`)) return;
    await updateDoc(doc(db, 'dominoGames', gameId), { finished: true, winner: winnerName, finishedAt: new Date() });
  };

  const handleReopenGame = async () => {
    await updateDoc(doc(db, 'dominoGames', gameId), { finished: false, winner: null, finishedAt: null });
  };

  const handleDeleteGame = async () => {
    if (!confirm(`Delete game ${gameId}? This cannot be undone.`)) return;
    await deleteDoc(doc(db, 'dominoGames', gameId));
    onLeaveGame();
  };

  if (!gameData) {
    return (
      <div className="text-center p-8">
        <div className="font-bold text-gray-500 dark:text-gray-400">Loading Game Data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Claim Host banner */}
      {!isHost && (
        <button
          onClick={() => {
            if (confirm('Claim host on this device? You will be able to submit rounds and manage the game.')) {
              updateDoc(doc(db, 'dominoGames', gameId), { hostDeviceId: getDeviceId() });
            }
          }}
          className="w-full flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-semibold px-4 py-3 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 active:bg-indigo-200 transition text-sm"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Claim Host
          </span>
          <span className="text-xs font-normal text-indigo-500 dark:text-indigo-400">Tap to manage &amp; submit rounds</span>
        </button>
      )}

      {/* Winner banner */}
      {isFinished && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 border border-yellow-200 dark:border-yellow-800 p-4 sm:p-5 rounded-xl text-center">
          <TrophyIcon className="w-8 h-8 text-yellow-500 mx-auto mb-1" />
          <h2 className="text-lg font-extrabold text-yellow-800 dark:text-yellow-400">
            {gameData.winner} wins!
          </h2>
          <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1 flex items-center justify-center gap-1">
            <LockIcon className="w-3 h-3" />
            Game finished
          </p>
        </div>
      )}

      {/* Game header */}
      <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-gray-500 dark:text-gray-400">Game</span>
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">{gameId}</span>
          {isFinished && <LockIcon className="text-yellow-500" />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isFinished ? (
            <button onClick={handleReopenGame}
              className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold py-1.5 px-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 active:bg-indigo-100 transition">
              Reopen
            </button>
          ) : rankedPlayers.length > 0 && gameData.rounds.length > 0 ? (
            <button onClick={handleEndGame}
              className="text-sm text-yellow-700 dark:text-yellow-500 font-semibold py-1.5 px-3 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/30 active:bg-yellow-100 transition flex items-center gap-1">
              <TrophyIcon className="w-4 h-4" />
              End Game
            </button>
          ) : null}
          <button onClick={handleDeleteGame}
            className="text-sm text-red-400 font-semibold py-1.5 px-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 active:bg-red-100 transition"
            title="Delete game">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button onClick={onLeaveGame}
            className="text-sm text-gray-500 dark:text-gray-400 font-semibold py-1.5 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 transition">
            Leave
          </button>
        </div>
      </div>

      {/* Add player - host only */}
      {!isFinished && isHost && (
        <div className="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <form onSubmit={handleAddPlayer} className="flex gap-2">
            <input
              type="text"
              value={newPlayer}
              onChange={(e) => setNewPlayer(e.target.value)}
              placeholder="Add player..."
              className="flex-1 min-w-0 p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <button type="submit" disabled={!newPlayer.trim()}
              className="bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50 shrink-0">
              Add
            </button>
          </form>
        </div>
      )}

      {/* Scoreboard table */}
      {rankedPlayers.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="-mx-[1px] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                  <th className="py-3 px-3 text-center font-semibold w-12">#</th>
                  <th className="py-3 px-3 text-left font-semibold">Player</th>
                  {gameData.rounds.map((r, ri) => (
                    <th key={r.roundNumber} className="py-3 px-2 text-center font-semibold whitespace-nowrap">
                      {roundLabel(ri)}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {rankedPlayers.map((player) => (
                  <tr key={player.id} className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/50 ${
                    isFinished && player.rank === 1 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
                  }`}>
                    <td className="py-3 px-3 text-center">
                      {player.rank === 1 ? (
                        <span className="inline-flex justify-center">
                          {isFinished ? <TrophyIcon className="text-yellow-500" /> : <GoldMedalIcon />}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 font-semibold">{player.rank}</span>
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
                          className="w-full p-1.5 border border-indigo-400 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                        />
                      ) : (
                        <button
                          onClick={() => startEditName(player)}
                          disabled={isFinished}
                          className={`flex items-center gap-1.5 transition-colors group text-left ${
                            isFinished ? 'cursor-default' : 'hover:text-indigo-600 dark:hover:text-indigo-400'
                          }`}
                        >
                          <PlayerIcon />
                          <span className={`font-medium ${
                            isFinished && player.rank === 1
                              ? 'text-yellow-800 dark:text-yellow-400'
                              : 'text-gray-800 dark:text-gray-100'
                          } ${!isFinished ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400' : ''}`}>
                            {player.name}
                          </span>
                          {!isFinished && (
                            <svg className="w-3 h-3 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            className="w-14 p-1 border border-indigo-400 rounded text-center text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                          />
                        ) : (
                          <button
                            onClick={() => startEditScore(ri, player.id, r.scores[player.id])}
                            disabled={isFinished}
                            className={`px-2 py-0.5 rounded transition-colors min-w-[2rem] inline-block ${
                              isFinished
                                ? 'text-gray-600 dark:text-gray-400 cursor-default'
                                : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                            }`}
                          >
                            {r.scores[player.id] ?? 0}
                          </button>
                        )}
                      </td>
                    ))}
                    <td className={`py-3 px-3 text-center font-bold ${
                      isFinished && player.rank === 1
                        ? 'text-yellow-700 dark:text-yellow-400'
                        : 'text-indigo-700 dark:text-indigo-400'
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

      {/* Score entry - only when game is active */}
      {!isFinished && gameData.players.length > 0 && (() => {
        const pending = gameData.pendingScores || {};
        const enteredCount = gameData.players.filter(p => pending[p.id] !== undefined).length;
        const allEntered = enteredCount === gameData.players.length;

        if (isHost) {
          return (
            <div className="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {roundLabel(gameData.rounds.length)}
                </h3>
                <span className="text-xs text-gray-400 dark:text-gray-500">{enteredCount} of {gameData.players.length} entered</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gameData.players.map((player) => {
                  const val = pending[player.id];
                  const hasScore = val !== undefined && val !== null;
                  return (
                    <button key={player.id} onClick={() => setScoreModal({ player })}
                      className={`w-full p-3 rounded-xl border-2 text-left transition ${
                        hasScore
                          ? 'border-green-400 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                      }`}>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{player.name}</p>
                      <p className={`text-2xl font-extrabold mt-0.5 ${hasScore ? 'text-green-700 dark:text-green-400' : 'text-gray-300 dark:text-gray-600'}`}>
                        {hasScore ? val : '—'}
                      </p>
                    </button>
                  );
                })}
              </div>
              <button onClick={onSubmitScores} disabled={!allEntered}
                className="w-full mt-4 bg-green-600 text-white font-semibold py-2.5 rounded-lg hover:bg-green-700 active:bg-green-800 transition disabled:opacity-40 disabled:cursor-not-allowed">
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
              <div className="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  {roundLabel(gameData.rounds.length)} — Your Score
                </h3>
                {hasMyScore ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-green-400 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{myPlayer.name}</p>
                      <p className="text-4xl font-extrabold text-green-700 dark:text-green-400">{myEntry}</p>
                    </div>
                    <button onClick={() => setScoreModal({ player: myPlayer })}
                      className="text-xs text-green-600 dark:text-green-400 font-semibold hover:text-green-800 dark:hover:text-green-300 transition px-3 py-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40">
                      Edit
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setScoreModal({ player: myPlayer })}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition text-center">
                    <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Tap to enter your score</p>
                    <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-0.5">Scan dominoes or enter manually</p>
                  </button>
                )}
              </div>
            ) : null}

            {/* Status dots */}
            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider mb-3">Table Status</p>
              <div className="flex flex-wrap gap-3">
                {gameData.players.map((player) => {
                  const entered = pending[player.id] !== undefined;
                  return (
                    <div key={player.id} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${entered ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                      <span className="text-xs text-gray-600 dark:text-gray-400">{player.name}</span>
                    </div>
                  );
                })}
              </div>
              {allEntered ? (
                <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-3 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  All scores entered — waiting for host to submit
                </p>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Waiting for {gameData.players.length - enteredCount} more player{gameData.players.length - enteredCount !== 1 ? 's' : ''}...</p>
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
    </div>
  );
}
