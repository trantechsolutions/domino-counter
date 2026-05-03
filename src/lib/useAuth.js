import { useState, useEffect } from 'react';
import { auth, db, signInAnonymously, onAuthStateChanged, doc, getDoc } from './firebase';

export function useAuth() {
  const [authUser, setAuthUser] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let initialized = false;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && !user.isAnonymous) {
        setAuthUser(user);
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        setIsSuperAdmin(adminSnap.exists());
      } else {
        setAuthUser(null);
        setIsSuperAdmin(false);
        if (!user) {
          await signInAnonymously(auth).catch(() =>
            setAuthError('Authentication failed. Please refresh.')
          );
          return;
        }
      }

      if (!initialized) {
        initialized = true;
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  return { authUser, isSuperAdmin, authReady, authError };
}
