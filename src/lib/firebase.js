import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCjauaPCk9l9HiYlyNXQTnDrnJDbeIDNHE",
  authDomain: "domino-score-tracker.firebaseapp.com",
  projectId: "domino-score-tracker",
  storageBucket: "domino-score-tracker.firebasestorage.app",
  messagingSenderId: "653174099619",
  appId: "1:653174099619:web:7daf0e58a6429dd3b07916",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  auth,
  db,
  signInAnonymously,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
};
