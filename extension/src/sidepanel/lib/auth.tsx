import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, hasFirebaseConfig } from "./firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      setError("Firebase is not configured. Check your extension/.env file.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
        
        // Sync token to session storage for service worker and API calls
        if (currentUser) {
          currentUser.getIdToken().then((token) => {
            chrome.storage.session.set({ firebaseIdToken: token });
          });
        } else {
          chrome.storage.session.remove("firebaseIdToken");
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, error } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        Loading session...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: 'var(--error)', padding: '1rem' }}>
        <strong>Configuration Error</strong>
        <p>{error}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <p>Please sign in to continue.</p>
        <button 
          onClick={() => {
            const loginUrl = `${import.meta.env.VITE_WEB_URL || 'http://localhost:5173'}/login?extensionId=${chrome.runtime.id}`;
            chrome.tabs.create({ url: loginUrl });
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Sign In on Website
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
