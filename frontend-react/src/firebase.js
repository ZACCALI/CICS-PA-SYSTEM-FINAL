import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB3odZ0rXs3fQdqQCJzbgSjKbU_ZX7yaHY",
  authDomain: "cics-pa-system-b131c.firebaseapp.com",
  projectId: "cics-pa-system-b131c",
  storageBucket: "cics-pa-system-b131c.firebasestorage.app",
  messagingSenderId: "1094836529930",
  appId: "1:1094836529930:web:f40033820124878a0de8f3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
