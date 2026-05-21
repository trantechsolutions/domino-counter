import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  db,
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
} from '../lib/firebase';
import { getDeviceId, getPlayerClaim, setPlayerClaim } from '../lib/deviceId';
import { useAuth } from '../lib/useAuth';
import PlayerClaimScreen from '../components/PlayerClaimScreen';
import Scoreboard from '../components/Scoreboard';
import { PipLoader } from '../components/Icons';

export default function GamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { authReady, authError } = useAuth();

  const [gameData, setGameData] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [showPlayerClaim, setShowPlayerClaim] = useState(false);
  const [claimChecked, setClaimChecked] = useState(false);
  const [error, setError] = useState('');

  const isHost = !gameData?.hostDeviceId || gameData.hostDeviceId === getDeviceId();

  // Wait for auth before subscribing
  useEffect(() => {
    if (!authReady) return;

    const unsub = onSnapshot(doc(db, 'dominoGames', gameId), (snap) => {
      if (!snap.exists()) {
        localStorage.removeItem('dominoLastGameId');
        navigate('/', { replace: true });
        return;
      }

      const data = snap.data();
      setGameData(data);

      // Restore or prompt for player claim — only evaluate once on first snapshot
      setClaimChecked((already) => {
        if (!already) {
          const claim = getPlayerClaim(gameId);
          if (claim) {
            const stillExists = (data.players || []).some((p) => p.id === claim.id);
            if (stillExists) {
              setMyPlayer(claim);
              setShowPlayerClaim(false);
            } else {
              setMyPlayer(null);
              setShowPlayerClaim(true);
            }
          } else {
            setShowPlayerClaim(true);
          }
          return true;
        }
        // On subsequent snapshots, only re-prompt if the claimed player was removed
        const claim = getPlayerClaim(gameId);
        if (claim) {
          const stillExists = (data.players || []).some((p) => p.id === claim.id);
          if (!stillExists) {
            setMyPlayer(null);
            setShowPlayerClaim(true);
          }
        }
        return true;
      });
    });

    localStorage.setItem('dominoLastGameId', gameId);
    return () => unsub();
  }, [authReady, gameId]);

  // Sync myPlayer name if host renames it in Firestore
  useEffect(() => {
    if (!myPlayer || !gameData?.players) return;
    const updated = gameData.players.find((p) => p.id === myPlayer.id);
    if (updated && updated.name !== myPlayer.name) {
      const newClaim = { ...myPlayer, name: updated.name };
      setMyPlayer(newClaim);
      setPlayerClaim(gameId, newClaim);
    }
  }, [gameData?.players]);

  const handleClaim = async (player) => {
    setPlayerClaim(gameId, player);
    setMyPlayer(player);
    setShowPlayerClaim(false);
    await updateDoc(doc(db, 'dominoGames', gameId), {
      [`deviceClaims.${player.id}`]: {
        claimedAt: new Date(),
        deviceHint: getDeviceId().slice(0, 6),
      },
    });
  };

  const handleLeaveGame = () => {
    localStorage.removeItem('dominoLastGameId');
    navigate('/');
  };

  const handlePendingScoreWrite = async (playerId, value, isWinner = false) => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return;
    const updates = { [`pendingScores.${playerId}`]: parsed };
    if (isWinner) updates.pendingWinner = playerId;
    if (!isWinner && gameData?.pendingWinner === playerId) updates.pendingWinner = null;
    await updateDoc(doc(db, 'dominoGames', gameId), updates);
  };

  const handleSubmitScores = async () => {
    const pending = gameData.pendingScores || {};
    const finalScores = {};
    for (const player of gameData.players) {
      const val = pending[player.id];
      if (val === undefined || val === null || isNaN(val)) {
        alert(`Missing score for ${player.name}. All players must enter a score first.`);
        return;
      }
      finalScores[player.id] = val;
    }
    const newRound = { roundNumber: gameData.rounds.length + 1, scores: finalScores };
    const allRounds = [...gameData.rounds, newRound];
    const updates = { rounds: arrayUnion(newRound), pendingScores: {}, pendingWinner: null };

    if (allRounds.length >= 13 && !gameData.finished) {
      const totals = gameData.players.map((p) => ({
        name: p.name,
        total: allRounds.reduce((sum, r) => sum + (r.scores[p.id] || 0), 0),
      }));
      totals.sort((a, b) => a.total - b.total);
      updates.finished = true;
      updates.winner = totals[0].name;
      updates.finishedAt = new Date();
    }

    await updateDoc(doc(db, 'dominoGames', gameId), updates);
  };

  const displayError = error || authError;

  if (!authReady || !gameData) {
    return (
      <div className="flex justify-center py-20">
        <PipLoader label="Loading game" />
      </div>
    );
  }

  return (
    <>
      {displayError && (
        <div className="flex items-start gap-2.5 bg-[rgb(var(--brand-soft))] border border-[rgb(var(--brand))] text-[rgb(var(--brand))] px-4 py-3 mb-5 rounded-2xl t-small" role="alert">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {displayError}
        </div>
      )}

      {showPlayerClaim ? (
        <PlayerClaimScreen
          gameId={gameId}
          gameData={gameData}
          isHost={isHost}
          onClaim={handleClaim}
          onSkip={() => setShowPlayerClaim(false)}
        />
      ) : (
        <Scoreboard
          gameId={gameId}
          gameData={gameData}
          onLeaveGame={handleLeaveGame}
          myPlayer={myPlayer}
          isHost={isHost}
          onPendingScoreWrite={handlePendingScoreWrite}
          onSubmitScores={handleSubmitScores}
        />
      )}
    </>
  );
}
