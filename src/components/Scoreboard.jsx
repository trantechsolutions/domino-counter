import { useState, useMemo } from 'react';
import { db, doc, updateDoc, arrayUnion } from '../lib/firebase';
import { PlayerIcon, GoldMedalIcon } from './Icons';

export default function Scoreboard({ gameId, gameData, onLeaveGame, scores, onScoreChange, onSubmitScores }) {
  const [newPlayer, setNewPlayer] = useState('');
  const [editingName, setEditingName] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingScore, setEditingScore] = useState(null);
  const [editScoreValue, setEditScoreValue] = useState('');

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
    await updateDoc(doc(db, 'dominoGames', gameId), {
      players: arrayUnion(player),
    });
    setNewPlayer('');
  };

  const startEditName = (player) => {
    setEditingName(player.id);
    setEditNameValue(player.name);
  };

  const saveEditName = async () => {
    if (!editNameValue.trim() || !editingName) {
      setEditingName(null);
      return;
    }
    const updatedPlayers = gameData.players.map((p) =>
      p.id === editingName ? { ...p, name: editNameValue.trim() } : p
    );
    await updateDoc(doc(db, 'dominoGames', gameId), { players: updatedPlayers });
    setEditingName(null);
  };

  const startEditScore = (roundIndex, playerId, currentValue) => {
    setEditingScore({ roundIndex, playerId });
    setEditScoreValue(String(currentValue ?? 0));
  };

  const saveEditScore = async () => {
    if (!editingScore) return;
    const { roundIndex, playerId } = editingScore;
    const parsed = parseInt(editScoreValue, 10);
    if (isNaN(parsed)) {
      setEditingScore(null);
      return;
    }
    const updatedRounds = gameData.rounds.map((r, i) => {
      if (i !== roundIndex) return r;
      return { ...r, scores: { ...r.scores, [playerId]: parsed } };
    });
    await updateDoc(doc(db, 'dominoGames', gameId), { rounds: updatedRounds });
    setEditingScore(null);
  };

  if (!gameData) {
    return (
      <div className="text-center p-8">
        <div className="font-bold text-gray-500">Loading Game Data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Game header */}
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-gray-500">Game</span>
          <span className="font-mono font-bold text-indigo-600 tracking-wider">{gameId}</span>
        </div>
        <button
          onClick={onLeaveGame}
          className="text-sm text-red-600 font-semibold py-1.5 px-3 rounded-lg hover:bg-red-50 active:bg-red-100 transition shrink-0"
        >
          Leave
        </button>
      </div>

      {/* Add player */}
      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
        <form onSubmit={handleAddPlayer} className="flex gap-2">
          <input
            type="text"
            value={newPlayer}
            onChange={(e) => setNewPlayer(e.target.value)}
            placeholder="Add player..."
            className="flex-1 min-w-0 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
          />
          <button
            type="submit"
            disabled={!newPlayer.trim()}
            className="bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50 shrink-0"
          >
            Add
          </button>
        </form>
      </div>

      {/* Scoreboard table - horizontal scroll on mobile */}
      {rankedPlayers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="-mx-[1px] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="py-3 px-3 text-center font-semibold w-12">#</th>
                  <th className="py-3 px-3 text-left font-semibold">Player</th>
                  {gameData.rounds.map((r) => (
                    <th key={r.roundNumber} className="py-3 px-2 text-center font-semibold whitespace-nowrap">
                      R{r.roundNumber}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rankedPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-3 text-center">
                      {player.rank === 1 ? (
                        <span className="inline-flex justify-center"><GoldMedalIcon /></span>
                      ) : (
                        <span className="text-gray-400 font-semibold">{player.rank}</span>
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
                          className="w-full p-1.5 border border-indigo-400 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => startEditName(player)}
                          className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors group text-left"
                        >
                          <PlayerIcon />
                          <span className="font-medium text-gray-800 group-hover:text-indigo-600">{player.name}</span>
                          <svg className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
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
                            className="w-14 p-1 border border-indigo-400 rounded text-center text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => startEditScore(ri, player.id, r.scores[player.id])}
                            className="text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-0.5 rounded transition-colors min-w-[2rem] inline-block"
                          >
                            {r.scores[player.id] ?? 0}
                          </button>
                        )}
                      </td>
                    ))}
                    <td className="py-3 px-3 text-center font-bold text-indigo-700">
                      {player.totalScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Score entry for new round */}
      {gameData.players.length > 0 && (
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wider mb-3">
            Round {gameData.rounds.length + 1}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {gameData.players.map((player) => (
              <div key={player.id}>
                <label className="text-sm font-medium text-gray-600 block mb-1">{player.name}</label>
                <input
                  type="number"
                  value={scores[player.id] ?? ''}
                  onChange={(e) => onScoreChange(player.id, e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <button
            onClick={onSubmitScores}
            className="w-full mt-4 bg-green-600 text-white font-semibold py-2.5 rounded-lg hover:bg-green-700 active:bg-green-800 transition"
          >
            Submit Scores
          </button>
        </div>
      )}
    </div>
  );
}
