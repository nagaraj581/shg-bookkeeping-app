import React, { useContext, useState, useEffect, createContext } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase"; // adjust if your firebase.js is in src/
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
  setCurrentUser(user);

  if (user) {
    try {
      const projectId = "shg-bookkeeping-app"; // ⚠️ confirm this if different

      const userRef = doc(
        db,
        "artifacts",
        projectId,
        "users",
        user.uid
      );

      await setDoc(
        userRef,
        {
          email: user.email,
          name: user.displayName || "",
          lastSeen: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Error updating lastSeen:", err);
    }
  }

  setLoading(false);
});

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
