import { useState, useEffect } from 'react';
import {
  auth,
  db,
  signInAnonymously,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
} from './lib/firebase';
import Lobby from './components/Lobby';
import Scoreboard from './components/Scoreboard';
import PipTracker from './components/PipTracker';
import TabNav from './components/TabNav';

const generateGameId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export default function App() {
  const [gameId, setGameId] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tracker');
  const [scores, setScores] = useState({});

  const handleJoinGame = (id, isAutoJoin = false) => {
    setIsLoading(true);
    const upperId = id.toUpperCase();
    getDoc(doc(db, 'dominoGames', upperId))
      .then((docSnap) => {
        if (docSnap.exists()) {
          localStorage.setItem('dominoLastGameId', upperId);
          setGameId(upperId);
          setActiveTab('tracker');
          setError('');
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
    signInAnonymously(auth).catch(() => {
      setError('Authentication failed. Please refresh.');
    });

    const lastGameId = localStorage.getItem('dominoLastGameId');
    if (lastGameId) {
      handleJoinGame(lastGameId, true);
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, 'dominoGames', gameId), (docSnap) => {
      if (docSnap.exists()) {
        setGameData(docSnap.data());
      } else {
        setError(`Game with ID ${gameId} not found.`);
        setGameId(null);
        localStorage.removeItem('dominoLastGameId');
      }
    });
    return () => unsub();
  }, [gameId]);

  useEffect(() => {
    if (gameData?.players) {
      const initialScores = {};
      gameData.players.forEach((p) => {
        initialScores[p.id] = scores[p.id] || '';
      });
      setScores(initialScores);
    }
  }, [gameData?.players ? JSON.stringify(gameData.players) : '']);

  const handleCreateGame = async () => {
    setIsLoading(true);
    const newGameId = generateGameId();
    await setDoc(doc(db, 'dominoGames', newGameId), {
      createdAt: new Date(),
      players: [],
      rounds: [],
    });
    localStorage.setItem('dominoLastGameId', newGameId);
    setGameId(newGameId);
    setActiveTab('tracker');
    setIsLoading(false);
  };

  const handleLeaveGame = () => {
    localStorage.removeItem('dominoLastGameId');
    setGameId(null);
    setGameData(null);
    setError('');
  };

  const handleScoreChange = (playerId, value) => {
    setScores((prev) => ({ ...prev, [playerId]: value }));
  };

  const handleSubmitScores = async () => {
    const finalScores = {};
    for (const player of gameData.players) {
      const scoreString = scores[player.id];
      if (scoreString === '' || scoreString === null || isNaN(parseInt(scoreString, 10))) {
        alert('Please enter a valid score for every player. A score of 0 is valid.');
        return;
      }
      finalScores[player.id] = parseInt(scoreString, 10);
    }
    await updateDoc(doc(db, 'dominoGames', gameId), {
      rounds: arrayUnion({
        roundNumber: gameData.rounds.length + 1,
        scores: finalScores,
      }),
    });
    const resetScores = {};
    gameData.players.forEach((p) => {
      resetScores[p.id] = '';
    });
    setScores(resetScores);
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
          <Lobby onCreateGame={handleCreateGame} onJoinGame={handleJoinGame} isLoading={isLoading} />
        ) : (
          <div>
            <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
            {activeTab === 'tracker' && (
              <Scoreboard
                gameId={gameId}
                gameData={gameData}
                onLeaveGame={handleLeaveGame}
                scores={scores}
                onScoreChange={handleScoreChange}
                onSubmitScores={handleSubmitScores}
              />
            )}
            {activeTab === 'pip_counter' && (
              <PipTracker gameData={gameData} onApplyScore={handleScoreChange} />
            )}
          </div>
        )}

        <footer className="text-center mt-8 pb-4 text-gray-300 text-xs">
          Built with React & Firebase
        </footer>
      </div>
    </div>
  );
}
