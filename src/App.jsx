import { useState, useEffect } from 'react';
import {
  auth,
  db,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
} from './lib/firebase';
import { getDeviceId, getPlayerClaim, setPlayerClaim, clearPlayerClaim } from './lib/deviceId';
import Lobby from './components/Lobby';
import Scoreboard from './components/Scoreboard';
import PlayerClaimScreen from './components/PlayerClaimScreen';

const generateGameId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export default function App() {
  const [gameId, setGameId] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [myPlayer, setMyPlayer] = useState(null);
  const [showPlayerClaim, setShowPlayerClaim] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Derived: is the current device the host?
  const isHost = !gameData?.hostDeviceId || gameData.hostDeviceId === getDeviceId();

  const handleJoinGame = (id, isAutoJoin = false) => {
    setIsLoading(true);
    const upperId = id.toUpperCase();
    getDoc(doc(db, 'dominoGames', upperId))
      .then((docSnap) => {
        if (docSnap.exists()) {
          localStorage.setItem('dominoLastGameId', upperId);
          setGameId(upperId);
          setError('');
          // Restore existing claim or prompt
          const claim = getPlayerClaim(upperId);
          if (claim) {
            setMyPlayer(claim);
          } else {
            setShowPlayerClaim(true);
          }
        } else {
          if (!isAutoJoin) setError('Game not found.');
          localStorage.removeItem('dominoLastGameId');
        }
      })
      .catch(() => {
        if (!isAutoJoin) setError('Error checking game ID.');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    // Track named sign-ins (super admin) and fall back to anonymous for everyone else
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user && !user.isAnonymous) {
        setAuthUser(user);
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        setIsSuperAdmin(adminSnap.exists());
      } else {
        setAuthUser(null);
        setIsSuperAdmin(false);
        // Ensure anonymous session exists for Firestore access
        if (!user) signInAnonymously(auth).catch(() => setError('Authentication failed. Please refresh.'));
      }
    });

    const lastGameId = localStorage.getItem('dominoLastGameId');
    if (lastGameId) {
      handleJoinGame(lastGameId, true);
    } else {
      setIsLoading(false);
    }

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, 'dominoGames', gameId), (docSnap) => {
      if (docSnap.exists()) {
        setGameData(docSnap.data());
      } else {
        setError(`Game with ID ${gameId} not found.`);
        setGameId(null);
        setMyPlayer(null);
        setShowPlayerClaim(false);
        localStorage.removeItem('dominoLastGameId');
      }
    });
    return () => unsub();
  }, [gameId]);

  // Sync myPlayer name if host renames the player in Firestore
  useEffect(() => {
    if (!myPlayer || !gameData?.players) return;
    const updated = gameData.players.find((p) => p.id === myPlayer.id);
    if (updated && updated.name !== myPlayer.name) {
      const newClaim = { ...myPlayer, name: updated.name };
      setMyPlayer(newClaim);
      setPlayerClaim(gameId, newClaim);
    }
  }, [gameData?.players]);

  const handleCreateGame = async () => {
    setIsLoading(true);
    const newGameId = generateGameId();
    await setDoc(doc(db, 'dominoGames', newGameId), {
      createdAt: new Date(),
      players: [],
      rounds: [],
      hostDeviceId: getDeviceId(),
      pendingScores: {},
      deviceClaims: {},
    });
    localStorage.setItem('dominoLastGameId', newGameId);
    setGameId(newGameId);
    setShowPlayerClaim(true); // Host also needs to claim a player slot
    setIsLoading(false);
  };

  const handleLeaveGame = () => {
    if (gameId) clearPlayerClaim(gameId);
    localStorage.removeItem('dominoLastGameId');
    setGameId(null);
    setGameData(null);
    setMyPlayer(null);
    setShowPlayerClaim(false);
    setError('');
  };

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

  // Write a single player's pending score directly to Firestore
  const handlePendingScoreWrite = async (playerId, value, isWinner = false) => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return;
    const updates = { [`pendingScores.${playerId}`]: parsed };
    if (isWinner) updates.pendingWinner = playerId;
    // If this player was the winner but is re-entering a real score, clear the winner flag
    if (!isWinner && gameData?.pendingWinner === playerId) updates.pendingWinner = null;
    await updateDoc(doc(db, 'dominoGames', gameId), updates);
  };

  const handleApplyPipScore = async (playerId, value) => {
    await handlePendingScoreWrite(playerId, value);
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

  if (isLoading && !gameId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <div className="mx-auto px-4 py-4 sm:py-6 max-w-2xl">
        <header className="text-center mb-5 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800">Domino Suite</h1>
          <p className="text-gray-400 text-sm mt-0.5">Score Tracking & Pip Counting</p>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mb-4 rounded-xl text-sm" role="alert">
            {error}
          </div>
        )}

        {!gameId ? (
          <Lobby
            onCreateGame={handleCreateGame}
            onJoinGame={handleJoinGame}
            isLoading={isLoading}
            authUser={authUser}
            isSuperAdmin={isSuperAdmin}
            onSignOut={() => { signOut(auth); setAuthUser(null); setIsSuperAdmin(false); }}
          />
        ) : showPlayerClaim ? (
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

        <footer className="text-center mt-8 pb-4 text-gray-300 text-xs">
          Built with React & Firebase
        </footer>
      </div>
    </div>
  );
}
