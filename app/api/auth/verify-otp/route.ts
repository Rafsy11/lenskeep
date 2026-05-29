import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, getDoc, deleteDoc } from 'firebase/firestore/lite';
import { app, firebaseConfig } from '@/lib/firebase';

export async function POST(req: NextRequest) {
  try {
    const { email, code, uid } = await req.json();
    
    if (!email || !code || !uid) {
      return NextResponse.json({ error: 'Email, code, and UID are required' }, { status: 400 });
    }

    // Fetch the OTP document saved in Firestore
    const dbLite = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    const otpDocRef = doc(dbLite, 'otp_codes', uid);
    const otpSnap = await getDoc(otpDocRef);

    if (!otpSnap.exists()) {
      return NextResponse.json({ error: 'Kode OTP tidak ditemukan atau silakan kirim ulang' }, { status: 400 });
    }

    const data = otpSnap.data();

    // Check if OTP matches
    if (data.code !== code) {
      return NextResponse.json({ error: 'Kode OTP salah' }, { status: 400 });
    }

    // Check expiration
    const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
    if (new Date() > expiresAt) {
      await deleteDoc(otpDocRef);
      return NextResponse.json({ error: 'Kode OTP telah kadaluarsa' }, { status: 400 });
    }

    // Consume the OTP code upon successful verification
    await deleteDoc(otpDocRef);

    return NextResponse.json({ success: true, message: 'OTP verified successfully' });
  } catch (err: any) {
    console.error('Verify OTP Error:', err);
    return NextResponse.json({ error: err?.message || 'Verification failed' }, { status: 500 });
  }
}
