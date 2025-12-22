import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBTPcqqCQgKc5Sfyr9elbbCONiINMlZRiM",
  authDomain: "cics-pa-system-v2.firebaseapp.com",
  projectId: "cics-pa-system-v2",
  storageBucket: "cics-pa-system-v2.firebasestorage.app",
  messagingSenderId: "577784873184",
  appId: "1:577784873184:web:1c4e6d87a5178ef9961085"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable Offline Persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn("Multiple tabs open, persistence disabled in this tab.");
    } else if (err.code == 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn("Browser doesn't support persistence.");
    }
});

export default app;
