'use client';

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { motion } from 'motion/react';
import { MailCheck, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function VerifyEmailPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const { user, userProfile, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Wait until auth is fully settled
    if (authLoading) return;

    const isVerified = userProfile?.emailVerified === true || user?.emailVerified === true;
    
    // If they are explicitly verified, push them out of the verification page to the dashboard
    if (userProfile && isVerified) {
      router.push('/');
      return;
    }

    // If completely unauthenticated natively and in context, push to login
    if (!user && !auth.currentUser) {
      // Debounce slightly to prevent race conditions during sign-up transitions
      const timer = setTimeout(() => {
        if (!auth.currentUser) {
          router.push('/');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, userProfile, authLoading, router]);

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!/^\d*$/.test(value)) return;
    
    // Support pasting multi-digits
    if (value.length > 1) {
       const digits = value.slice(0, 6).split('');
       const newOtp = [...otp];
       for (let i = 0; i < digits.length; i++) {
         if (index + i < 6) {
           newOtp[index + i] = digits[i];
         }
       }
       setOtp(newOtp);
       const nextIndex = Math.min(index + digits.length, 5);
       inputRefs.current[nextIndex]?.focus();
       return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setErrorMsg('Masukkan 6 digit kode OTP');
      return;
    }
    if (!user?.email) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Update user Firestore profile successfully verified mock
        await updateDoc(doc(db, 'users', user.uid), {
          emailVerified: true
        });
        
        // Use full reload to clear stale AuthContext context and fetch fresh verified document
        window.sessionStorage.removeItem('pendingVerification');
        window.location.href = '/';
      } else {
        setErrorMsg(data.error || 'Kode OTP salah atau kadaluarsa');
      }
    } catch (err) {
      setErrorMsg('Gagal memverifikasi kode');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!user?.email || resending) return;
    setResending(true);
    setErrorMsg('');
    try {
      await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      // Use native alert or just passive UI state (we will just show a temp alert for mockup)
      alert('Kode OTP baru telah dikirim ke terminal server Anda.');
    } catch (err) {
      setErrorMsg('Gagal mengirim ulang kode');
    } finally {
      setResending(false);
    }
  };

  const handleBackToLogin = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      window.sessionStorage.removeItem('pendingVerification');
      router.push('/');
    } catch (err) {
      console.error('Logout error:', err);
      router.push('/');
    } finally {
      setLoggingOut(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4 md:px-6 flex items-center justify-center bg-gradient-to-br from-indigo-50/70 via-slate-100 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20 text-slate-800 dark:text-slate-100 transition-all duration-300">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative w-full max-w-md bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 md:p-9 shadow-2xl backdrop-blur-xl z-20 space-y-6"
      >
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mx-auto shadow-sm">
            <MailCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Cek Email Anda
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed px-2">
              Kami telah mengirimkan 6 digit kode OTP ke <br/>
              <strong className="text-slate-700 dark:text-slate-300">{user?.email}</strong>
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-250 dark:border-rose-900/40 p-3 rounded-2xl flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 leading-normal">
              {errorMsg}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center space-x-2 pt-2">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-10 h-12 md:w-12 md:h-14 text-center text-lg font-black font-mono bg-slate-50 dark:bg-slate-805 border border-slate-200/80 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700"
              placeholder="-"
            />
          ))}
        </div>

        <button
          onClick={verifyOtp}
          disabled={loading || otp.join('').length !== 6}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 mt-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-500/70 disabled:opacity-75 text-white font-bold text-xs rounded-xl cursor-pointer active:scale-95 transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Memverifikasi...</span>
            </>
          ) : (
            <>
              <span>Verifikasi Kode</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>

        <div className="text-center mt-6">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Belum menerima kode?{' '}
            <button
              onClick={resendOtp}
              disabled={resending}
              className="font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {resending ? 'Mengirim...' : 'Kirim Ulang Kode'}
            </button>
          </p>
        </div>

        <div className="text-center pt-3 border-t border-slate-100 dark:border-slate-800/40 mt-4">
          <button
            onClick={handleBackToLogin}
            disabled={loggingOut}
            className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer inline-flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            {loggingOut ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <span>&larr; Kembali ke Login</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
