'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, LogIn, Sparkles, Loader2, AlertCircle, ArrowRight, Eye, EyeOff, Check, X, AtSign } from 'lucide-react';
import { getFirestore, doc, getDoc } from 'firebase/firestore/lite';
import { app, firebaseConfig } from '@/lib/firebase';

export default function Login() {
  const { loginWithGoogle, loginWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Form Fields
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  
  // New Enhanced Fields
  const [username, setUsername] = useState<string>('');
  const [isUsernameChecking, setIsUsernameChecking] = useState<boolean>(false);
  const [usernameError, setUsernameError] = useState<string>('');
  const [usernameSuccess, setUsernameSuccess] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [showEmailInUsePopup, setShowEmailInUsePopup] = useState<boolean>(false);

  // Checks
  const passMinLength = password.length >= 8;
  const passHasUpper = /[A-Z]/.test(password);
  const passHasLower = /[a-z]/.test(password);
  const passHasNumber = /[0-9]/.test(password);
  const passAllValid = passMinLength && passHasUpper && passHasLower && passHasNumber && password.length <= 128;

  const isEmailGmail = email ? /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email.trim()) : false;
  const isValidUsernameFormat = /^[a-z0-9_]+$/.test(username);

  const isSubmitDisabled = isLoading || (isSignUp && (
    !username || !isValidUsernameFormat || !!usernameError || isUsernameChecking ||
    !passAllValid ||
    !isEmailGmail ||
    password !== confirmPassword ||
    !name
  ));

  useEffect(() => {
    if (!isSignUp) return;

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
        // Add a timeout to prevent infinite spinner if Firebase SDK hangs
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
          setUsernameSuccess('Status koneksi: offline. Validasi saat mendaftar.');
          setUsernameError('');
        } else {
          setUsernameError('Gagal memeriksa username.');
        }
      } finally {
        setIsUsernameChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, isSignUp]);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled && isSignUp) return;
    setErrorMsg('');

    // Basics validation
    if (!email || !password) {
      setErrorMsg('Semua kolom wajib diisi!');
      return;
    }

    if (!isSignUp && password.length < 6) {
      setErrorMsg('Kata sandi harus minimal 6 karakter!');
      return;
    }

    if (isSignUp) {
      if (!name) {
        setErrorMsg('Nama lengkap wajib diisi!');
        return;
      }
      if (!isValidUsernameFormat) {
        setErrorMsg('Format username tidak valid!');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Konfirmasi kata sandi tidak cocok!');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        // Explicit explicit state/routing flag to stop immediate unmounting and allow verification routing priority
        window.sessionStorage.setItem('pendingVerification', 'true');
        
        await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        
        await signUpWithEmail(email, password, name, username);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      console.error('Authentication process failed:', err);
      let localizedError = isSignUp ? 'Terjadi kesalahan saat mendaftar. Silakan coba lagi.' : 'Gagal melakukan otentikasi. Silakan periksa kembali.';
      
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        setShowEmailInUsePopup(true);
        return;
      } else if (code === 'auth/wrong-password') {
        localizedError = 'Kata sandi salah. Silakan coba lagi.';
      } else if (code === 'auth/user-not-found') {
        localizedError = 'Akun email tidak ditemukan. Pastikan email belum terdaftar atau daftar akun baru.';
      } else if (code === 'auth/invalid-email') {
        localizedError = 'Format alamat email tidak valid.';
      } else if (code === 'auth/weak-password') {
        localizedError = 'Kata sandi yang dimasukkan terlalu lemah.';
      }
      setErrorMsg(localizedError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setIsLoading(true);
    try {
      await loginWithGoogle();
      // Routing is now handled entirely within AuthContext globally.
    } catch (err: any) {
      console.error('Google provider authentication failed:', err);
      setErrorMsg(err?.message || 'Gagal masuk dengan Google.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 md:px-6 flex items-center justify-center bg-gradient-to-br from-indigo-50/70 via-slate-100 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20 text-slate-800 dark:text-slate-100 transition-all duration-300" id="login-viewport-wrapper">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <AnimatePresence>
        {showEmailInUsePopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 w-full max-w-sm shadow-2xl relative"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Email Sudah Terdaftar</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Alamat email <span className="font-semibold">{email}</span> sudah digunakan oleh akun lain. Silakan masuk untuk melanjutkan.
                </p>
                <div className="w-full pt-2">
                  <button
                    onClick={() => {
                      setShowEmailInUsePopup(false);
                      setIsSignUp(false);
                      setErrorMsg('');
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-md flex justify-center items-center cursor-pointer"
                  >
                    Menuju Halaman Masuk
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative w-full max-w-md bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 md:p-9 shadow-2xl backdrop-blur-xl z-20 space-y-6"
        id="login-[card]-panel"
      >
        {/* Brand/logo Header block matching LensKeep styling */}
        <div className="text-center space-y-2.5" id="login-brand-meta">
          <div className="inline-flex items-center justify-center w-12 h-12 relative overflow-hidden rounded-2xl shadow-sm" id="auth-logo-badge">
            <Image priority src="/lenskeep_brand_logo.png" alt="LensKeep Logo" fill className="object-contain" referrerPolicy="no-referrer" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center justify-center space-x-1">
              <span>Lens</span>
              <span className="text-indigo-600 dark:text-indigo-400">Keep</span>
              <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
            </h1>
            <p className="text-xs text-slate-505 dark:text-slate-400 font-medium max-w-[280px] mx-auto leading-normal">
              Ekstensi memori visual bertenaga AI dengan pencarian instan Gemini
            </p>
          </div>
        </div>

        {/* Tab switchers to toggle between signin and sign up */}
        <div className="flex border-b border-slate-200/60 dark:border-slate-800/60 p-0.5" id="auth-tab-row">
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setErrorMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold transition-all rounded-lg cursor-pointer ${
              !isSignUp 
                ? 'text-indigo-600 dark:text-indigo-400 bg-slate-50 dark:bg-slate-805/40 shadow-sm border border-slate-200/30' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Masuk Akun
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setErrorMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold transition-all rounded-lg cursor-pointer ${
              isSignUp 
                ? 'text-indigo-600 dark:text-indigo-400 bg-slate-50 dark:bg-slate-805/40 shadow-sm border border-slate-200/30' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Daftar Baru
          </button>
        </div>

        {/* Credentials Form Section */}
        <form onSubmit={handleAuthAction} className="space-y-4" id="auth-credentials-form">
          {/* Full Name field (Sign up only) */}
          {isSignUp && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Nama Lengkap</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-805 border border-slate-200/80 dark:border-slate-800 text-base md:text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400/80 transition-all font-mono"
                />
              </div>
            </div>
          )}

          {/* Username field (Sign up only) */}
          {isSignUp && (
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
          )}

          {/* Email input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Alamat Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="developer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-slate-50 dark:bg-slate-805 border text-base md:text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400/80 transition-all font-mono ${isSignUp && email && !isEmailGmail ? 'border-red-500/50' : 'border-slate-200/80 dark:border-slate-800'}`}
              />
            </div>
            {isSignUp && email && !isEmailGmail && (
              <p className="text-[10px] font-medium text-red-500 flex items-center space-x-1">
                <AlertCircle className="w-3 h-3" />
                <span>Hanya menerima pendaftaran menggunakan akun @gmail.com</span>
              </p>
            )}
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Kata Sandi</label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                maxLength={128}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-805 border border-slate-200/80 dark:border-slate-800 text-base md:text-sm rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400/80 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isSignUp && password && (
              <div className="space-y-1 mt-2 text-[10px] font-medium">
                <div className={`flex items-center space-x-1.5 transition-colors ${passMinLength ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {passMinLength ? <Check className="w-3 h-3" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                  <span>Minimal 8 karakter</span>
                </div>
                <div className={`flex items-center space-x-1.5 transition-colors ${passHasUpper ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {passHasUpper ? <Check className="w-3 h-3" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                  <span>Minimal 1 huruf kapital</span>
                </div>
                <div className={`flex items-center space-x-1.5 transition-colors ${passHasLower ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {passHasLower ? <Check className="w-3 h-3" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                  <span>Minimal 1 huruf kecil</span>
                </div>
                <div className={`flex items-center space-x-1.5 transition-colors ${passHasNumber ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {passHasNumber ? <Check className="w-3 h-3" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 ml-0.5 mr-1" />}
                  <span>Minimal 1 angka</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password (Sign up only) */}
          {isSignUp && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Ulangi Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  maxLength={128}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full bg-slate-50 dark:bg-slate-805 border text-base md:text-sm rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400/80 transition-all font-mono ${password && confirmPassword && password !== confirmPassword ? 'border-red-500/50' : 'border-slate-200/80 dark:border-slate-800'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && confirmPassword && password !== confirmPassword && (
                <p className="text-[10px] font-medium text-red-500 flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Kata sandi tidak cocok</span>
                </p>
              )}
            </div>
          )}

          {/* Error Notification Alert Banner inside form */}
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-500/10 border border-red-500/50 text-red-500 dark:text-red-400 p-3 rounded-md flex items-start space-x-2.5 overflow-hidden"
                id="auth-error-banner"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="text-sm font-medium leading-normal" id="err-text-container">
                  {errorMsg}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form Submit Button */}
          <button
            type="submit"
            disabled={isSignUp ? isSubmitDisabled : isLoading}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-500/70 text-white font-bold text-xs rounded-xl cursor-pointer active:scale-95 transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5" />
                <span>{isSignUp ? 'Daftar Sekarang' : 'Masuk ke LensKeep'}</span>
              </>
            )}
          </button>
        </form>

        {/* Separator Divider */}
        <div className="relative flex py-2 items-center text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          <div className="flex-grow border-t border-slate-200/60 dark:border-slate-800/60"></div>
          <span className="flex-shrink mx-4">atau masuk dengan</span>
          <div className="flex-grow border-t border-slate-200/60 dark:border-slate-800/60"></div>
        </div>

        {/* Google SSO Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center space-x-2.5 py-3 px-4 bg-white hover:bg-slate-50 dark:bg-slate-805/40 dark:hover:bg-slate-800/50 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-bold rounded-xl transition-all border border-slate-200/80 dark:border-slate-800 cursor-pointer shadow-sm disabled:opacity-60"
          id="google-sso-cta"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          <span>Lanjutkan dengan Akun Google</span>
        </button>

        {/* Security and config meta feedback */}
        <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center leading-normal" id="auth-compliance-footer">
          Keamanan terproteksi dengan <strong className="font-extrabold text-slate-600 dark:text-slate-300">Firebase Firestore & Auth</strong>. Sandbox terenkripsi penuh.
        </div>
      </motion.div>
    </div>
  );
}
