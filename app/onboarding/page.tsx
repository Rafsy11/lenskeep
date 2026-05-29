'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore/lite';
import { auth, app, firebaseConfig } from '@/lib/firebase';
import { User as UserIcon, AtSign, Loader2, Sparkles, Check, X } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';

export default function OnboardingPage() {
  const { user, syncUserProfile } = useAuth();
  const router = useRouter();
  
  const [fullName, setFullName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  const [isUsernameChecking, setIsUsernameChecking] = useState<boolean>(false);
  const [usernameError, setUsernameError] = useState<string>('');
  const [usernameSuccess, setUsernameSuccess] = useState<string>('');

  const isValidUsernameFormat = /^[a-z0-9_]+$/.test(username);
  const isSubmitDisabled = isLoading || !fullName.trim() || !username.trim() || !isValidUsernameFormat || !!usernameError || isUsernameChecking;

  useEffect(() => {
    setUsernameError('');
    setUsernameSuccess('');
    setIsUsernameChecking(false);

    if (!username) return;

    if (!/^[a-z0-9_]+$/.test(username)) {
      setUsernameError('Hanya huruf kecil, angka, dan garis bawah (_).');
      return;
    }

    setIsUsernameChecking(true);
    const timer = setTimeout(async () => {
      try {
        const dbLite = getFirestore(app, firebaseConfig.firestoreDatabaseId);
        const docRef = doc(dbLite, 'usernames', username);
        // Add a 5 second timeout to prevent infinite spinner if Firebase SDK hangs
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 5000)
        );
        const docSnap = await Promise.race([
          getDoc(docRef),
          timeoutPromise
        ]) as any;
        
        if (docSnap.exists()) {
          setUsernameError('Username sudah dipakai.');
        } else {
          setUsernameSuccess('Username tersedia.');
        }
      } catch (e: any) {
        console.error('Username check failed', e);
        if (e?.message && String(e.message).toLowerCase().includes('offline')) {
          setUsernameSuccess('Status koneksi: offline. Validasi saat menyimpan.');
          setUsernameError('');
        } else {
          setUsernameError('Gagal memeriksa username.');
        }
      } finally {
        setIsUsernameChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;
    
    if (!user || !user.uid) {
      const authErr = 'Autentikasi gagal, ID pengguna tidak ditemukan. Silakan login kembali.';
      setErrorMsg(authErr);
      alert(authErr);
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const dbLite = getFirestore(app, firebaseConfig.firestoreDatabaseId);
      
      // 1. Set username registry
      await setDoc(doc(dbLite, 'usernames', username), {
        uid: user.uid,
        createdAt: serverTimestamp()
      });

      // 2. Set user profile
      const userRef = doc(dbLite, 'users', user.uid);
      await setDoc(userRef, {
        userId: user.uid,
        uid: user.uid,
        email: user.email || '',
        displayName: fullName,
        fullName: fullName,
        username: username,
        emailVerified: user.emailVerified || (user.providerData.some(p => p.providerId === 'google.com') ? true : false),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // 3. Sync the global user profile state to avoid route flashing back to onboarding
      await syncUserProfile(user);

      // 4. Proceed to dashboard
      router.push('/');
    } catch (err: any) {
      console.error('Complete Profile error:', err);
      const displayMsg = err?.message || 'Gagal menyelesaikan profil. Silakan coba lagi.';
      setErrorMsg(displayMsg);
      alert('Gagal menyelesaikan profil:\n' + displayMsg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 md:px-6 flex items-center justify-center bg-gradient-to-br from-indigo-50/70 via-slate-100 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20 text-slate-800 dark:text-slate-100">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative w-full max-w-md bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 md:p-9 shadow-2xl backdrop-blur-xl z-20 space-y-6"
      >
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center justify-center w-12 h-12 relative overflow-hidden rounded-2xl shadow-sm">
            <Image priority src="/lenskeep_brand_logo.png" alt="LensKeep Logo" fill className="object-contain" referrerPolicy="no-referrer" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center justify-center space-x-1">
              <span>Selesaikan</span>
              <span className="text-indigo-600 dark:text-indigo-400">Profil</span>
              <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
            </h1>
            <p className="text-xs text-slate-505 dark:text-slate-400 font-medium max-w-[280px] mx-auto leading-normal">
              Satu langkah lagi untuk mulai menggunakan LensKeep
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Nama Lengkap</label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-805 border border-slate-200/80 dark:border-slate-800 text-base md:text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400/80 transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Username</label>
            <div className="relative">
              <AtSign className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                placeholder="johndoe_99"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-805 border border-slate-200/80 dark:border-slate-800 text-base md:text-sm rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400/80 transition-all font-mono"
              />
              {isUsernameChecking && (
                <div className="absolute right-3.5 top-3">
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                </div>
              )}
            </div>
            {usernameError && (
              <p className="text-[10px] font-medium text-red-500 flex items-center space-x-1">
                <X className="w-3 h-3" />
                <span>{usernameError}</span>
              </p>
            )}
            {usernameSuccess && !usernameError && (
              <p className="text-[10px] font-medium text-emerald-500 flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>{usernameSuccess}</span>
              </p>
            )}
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 dark:text-red-400 p-3 rounded-md text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-500/70 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-md disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>Lanjutkan ke Dashboard</span>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
