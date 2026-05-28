'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

interface AuthContextType {
  user: User | null;
  userProfile: any | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string, username?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  // Synchronize dynamic user profiles on authentication transitions
  const syncUserProfile = async (firebaseUser: User, name?: string) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const newData = {
          userId: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: name || firebaseUser.displayName || 'Anonymous User',
          emailVerified: firebaseUser.providerData.some(p => p.providerId === 'google.com') ? true : false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(userRef, newData);
        setUserProfile(newData);
      } else {
        setUserProfile(userSnap.data());
      }
    } catch (error) {
      console.warn('Could not sync user profile in firestore (possibly rules/auth status is finalizing):', error);
      setUserProfile(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await syncUserProfile(firebaseUser);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Global user verification enforcement redirect
  useEffect(() => {
    if (loading) return; // Wait until initial auth load resolves

    // Only assess rules if we actually have a logged-in user profile or firebase user
    if (user) {
      // 1) Handle check for verification status (local firestore check override, then fallback to native emailVerified if applicable)
      const isVerified = userProfile?.emailVerified === true || user.emailVerified === true;
      
      // 2) Apply logic
      if (!isVerified && pathname !== '/verify-email') {
        router.push('/verify-email');
      }
    }
  }, [user, userProfile, loading, pathname, router]);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string, username?: string) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: name
        });
        await syncUserProfile(userCredential.user, name);
        if (username) {
          await setDoc(doc(db, 'usernames', username), {
            uid: userCredential.user.uid,
            createdAt: serverTimestamp()
          });
        }
        
        try {
          await sendEmailVerification(userCredential.user);
        } catch (verificationError) {
          console.error("Failed to send verification email:", verificationError);
        }
      }
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        loginWithGoogle,
        loginWithEmail,
        signUpWithEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
