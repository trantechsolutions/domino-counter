import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, signOut, doc, setDoc, getDoc } from '../lib/firebase';
import { getDeviceId } from '../lib/deviceId';
import { useAuth } from '../lib/useAuth';
import Lobby from '../components/Lobby';

const generateGameId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export default function LobbyPage() {
  const navigate = useNavigate();
  const { authUser, isSuperAdmin, authReady, authError } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(authError);

  // Auto-rejoin: once auth is ready, redirect to last game if one exists
  useEffect(() => {
    if (!authReady) return;
    const lastGameId = localStorage.getItem('dominoLastGameId');
    if (lastGameId) {
      navigate(`/${lastGameId}`, { replace: true });
    }
  }, [authReady]);

  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  const handleCreateGame = async () => {
    setIsCreating(true);
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
    navigate(`/${newGameId}`);
  };

  const handleJoinGame = (id) => {
    const upperId = id.toUpperCase();
    getDoc(doc(db, 'dominoGames', upperId))
      .then((snap) => {
        if (snap.exists()) {
          localStorage.setItem('dominoLastGameId', upperId);
          navigate(`/${upperId}`);
        } else {
          setError('Game not found.');
        }
      })
      .catch(() => setError('Error checking game ID.'));
  };

  if (!authReady) {
    return (
      <div className="flex justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent" style={{ animation: 'spin 0.7s linear infinite' }} />
          <p className="text-slate-400 dark:text-slate-500 text-xs tracking-widest uppercase">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-400 px-4 py-3 mb-5 rounded-2xl text-sm" role="alert">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {error}
        </div>
      )}
      <Lobby
        onCreateGame={handleCreateGame}
        onJoinGame={handleJoinGame}
        isLoading={isCreating}
        authUser={authUser}
        isSuperAdmin={isSuperAdmin}
        onSignOut={() => signOut(auth)}
      />
    </>
  );
}
