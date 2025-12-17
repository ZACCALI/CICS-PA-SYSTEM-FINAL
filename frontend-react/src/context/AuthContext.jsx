import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from '../firebase';
import api from '../api/axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); // Firestore data (role, status)
  const [loading, setLoading] = useState(true);

  // Load User Session and Role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, fetch role/status from Firestore
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserData(data);
                // Merge auth user and firestore data
                setCurrentUser({ ...user, ...data });
            } else {
                // Determine if this is the FIRST user (Admin seed might not exist yet?)
                // Or just set basic user
                setUserData({ role: 'user', status: 'pending' });
                setCurrentUser({ ...user, role: 'user', status: 'pending' });
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            setCurrentUser(user);
        }
      } else {
        setCurrentUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    // Role check is done in useEffect, but we might want to wait for it here?
    // For now, allow login, components will redirect based on 'currentUser' state updates.
    
    // Explicitly fetch doc to return robust user object immediately if needed
    const userDocRef = doc(db, "users", result.user.uid);
    const userDoc = await getDoc(userDocRef);
    let data = {};
    if (userDoc.exists()) data = userDoc.data();

    // Block pending users
    if (data.status === 'pending') {
         await signOut(auth);
         throw new Error("Account is pending approval. Please contact Admin.");
    }
    
    const fullUser = { ...result.user, ...data };
    // Add redirect helper
    fullUser.redirect = data.role === 'admin' ? '/admin-dashboard' : '/user-dashboard';
    
    return fullUser;
  };

  const signup = async ({ email, password, name }) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    // Update Auth Profile
    await updateProfile(user, { displayName: name });

    // Create Firestore Document
    const defaultRole = 'user'; // Hardcode user for signups, Admin created manually or seeded
    const newUserDoc = {
        name,
        email,
        role: defaultRole,
        status: 'pending', // Default to pending
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString() // Initial login
    };

    await setDoc(doc(db, "users", user.uid), newUserDoc);

    // Provide robust response
    return { 
        ...user, 
        ...newUserDoc, 
        redirect: '/user-dashboard' 
    };
  };

  const logout = () => {
    return signOut(auth);
  };

  // Admin Methods - Now calling Backend API
  const getAllUsers = async () => {
    const response = await api.get('/account/');
    return response.data;
  };

  const adminApproveUser = async (uid) => {
      await api.put(`/account/approve/${uid}`);
      return true;
  };

  const adminResetPassword = async (uid) => {
     await api.post(`/account/reset/${uid}`);
     return "12345678"; // As defined in backend
  };

  const adminDeleteUser = async (uid) => {
      await api.delete(`/account/${uid}`);
      return true;
  };
  
  // New helper for password reset (email)
  const resetPasswordEmail = (email) => {
      return sendPasswordResetEmail(auth, email);
  };

  const updateUser = async (data) => {
      const user = auth.currentUser;
      if (!user) return;

      try {
          // 1. Password Update
          if (data.password) {
              await updatePassword(user, data.password);
          }

          // 2. Profile Update (Auth)
          if (data.name || data.avatar) {
              await updateProfile(user, { 
                  displayName: data.name,
                  photoURL: data.avatar 
              });
          }

          // 3. Firestore Update
          // Filter out password from firestore data
          const { password, ...firestoreData } = data;
          if (Object.keys(firestoreData).length > 0) {
              await updateDoc(doc(db, "users", user.uid), firestoreData);
          }

          // 4. Update Local State
          setCurrentUser(prev => ({ ...prev, ...data }));
          return true;
      } catch (error) {
          console.error("Error updating user:", error);
          throw error;
      }
  };

  const value = {
    currentUser,
    login,
    signup,
    logout,
    updateUser, // Restored
    getAllUsers, 
    adminApproveUser,
    adminDeleteUser,
    adminResetPassword,
    resetPasswordEmail
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

