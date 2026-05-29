'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  User,
  UserCredential,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore/lite';
import { auth, app, firebaseConfig } from './firebase';

const dbLite = getFirestore(app, firebaseConfig.firestoreDatabaseId);

let isSigningUp = false;

interface AuthContextType {
  user: User | null;
  userProfile: any | null;
  loading: boolean;
  loginWithGoogle: () => Promise<UserCredential>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string, username?: string) => Promise<void>;
  logout: () => Promise<void>;
  syncUserProfile: (firebaseUser: User, name?: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pending, setPending] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  // Synchronize dynamic user profiles on authentication transitions
  const syncUserProfile = async (firebaseUser: User, name?: string) => {
    try {
      const userRef = doc(dbLite, 'users', firebaseUser.uid);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Profile sync timeout')), 6000));
      
      const userSnap = await Promise.race([
        getDoc(userRef),
        timeoutPromise
      ]) as any;

      if (!userSnap.exists()) {
        // Must wait to ensure reload is complete
        await firebaseUser.reload().catch(() => {});
        const isEmailVerified = firebaseUser.emailVerified || firebaseUser.providerData.some(p => p.providerId === 'google.com');

        const newData = {
          userId: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: name || firebaseUser.displayName || 'Anonymous User',
          emailVerified: isEmailVerified,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await Promise.race([
          setDoc(userRef, newData, { merge: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Profile create timeout')), 4000))
        ]);
        setUserProfile(newData);
        return newData;
      } else {
        const data = userSnap.data();
        // Fallback: if data is somehow marked unverified but Firebase Auth says verified, keep it synced in session state
        if (!data.emailVerified && firebaseUser.emailVerified) {
          data.emailVerified = true; 
        }
        setUserProfile(data);
        return data;
      }
    } catch (error) {
      console.warn('Could not sync user profile in firestore:', error);
      // Fallback object to give them basic access
      const fallbackData = {
        userId: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || 'Anonymous',
        emailVerified: firebaseUser.emailVerified,
      };
      setUserProfile(fallbackData);
      return fallbackData;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (isSigningUp) return;

      setPending(true);
      setLoading(true);

      if (!currentUser) {
        setUser(null);
        setUserProfile(null);
        setPending(false);
        setLoading(false);
      } else {
        try {
          await currentUser.reload().catch(() => {});
          await syncUserProfile(currentUser);
          setUser(currentUser);
        } catch (error) {
          console.error('Error during auth listener update:', error);
        } finally {
          setPending(false);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Global user verification and onboarding enforcement redirect
  useEffect(() => {
    if (pending) return;

    if (user) {
      const isVerified = userProfile?.emailVerified === true || user.emailVerified === true;
      const hasUsername = !!userProfile?.username;

      if (!isVerified) {
        if (pathname !== '/verify-email') {
          router.replace('/verify-email');
        }
      } else {
        // Verification passed, now enforce onboarding status
        if (!hasUsername) {
          if (pathname !== '/onboarding') {
            router.replace('/onboarding');
          }
        } else {
          // Both verified and onboarded - redirect away from gatekeeper screens
          if (pathname === '/onboarding' || pathname === '/verify-email' || pathname === '/login') {
            router.replace('/');
          }
        }
      }
    }
  }, [user, userProfile, pending, pathname, router]);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return await signInWithPopup(auth, provider);
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
    isSigningUp = true;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: name
        });
        
        const dbLite = getFirestore(app, firebaseConfig.firestoreDatabaseId);
        
        // Ensure the initial profile includes the username so the user bypasses onboarding
        await setDoc(doc(dbLite, 'users', userCredential.user.uid), {
          userId: userCredential.user.uid,
          email: userCredential.user.email || '',
          displayName: name,
          fullName: name,
          username: username || '',
          emailVerified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });

        if (username) {
          await setDoc(doc(dbLite, 'usernames', username), {
            uid: userCredential.user.uid,
            createdAt: serverTimestamp()
          });
        }
        
        await syncUserProfile(userCredential.user, name);
        
        try {
          await sendEmailVerification(userCredential.user);
        } catch (verificationError) {
          console.error("Failed to send verification email:", verificationError);
        }
      }
    } catch (error) {
      setLoading(false);
      throw error;
    } finally {
      isSigningUp = false;
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

  // Determine actual authorization to prevent rendering children during redirects
  let isAuthorized = true;
  if (!pending && user) {
    const isVerified = userProfile?.emailVerified === true || user.emailVerified === true;
    const hasUsername = !!userProfile?.username;

    if (!isVerified) {
      if (pathname !== '/verify-email') {
        isAuthorized = false;
      }
    } else if (!hasUsername) {
      if (pathname !== '/onboarding') {
        isAuthorized = false;
      }
    } else {
      if (pathname === '/onboarding' || pathname === '/verify-email') {
        isAuthorized = false;
      }
    }
  }

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
        syncUserProfile,
      }}
    >
      {pending || !isAuthorized ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
            <p className="font-mono text-xs text-slate-400 tracking-wider">Memuat LensKeep ...</p>
          </div>
        </div>
      ) : (
        children
      )}
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
