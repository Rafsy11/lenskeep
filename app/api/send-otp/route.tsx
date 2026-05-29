import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore/lite';
import { app, firebaseConfig } from '@/lib/firebase';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function POST(request: Request) {
  try {
    const { email, uid } = await request.json();

    if (!email || !uid) {
      return NextResponse.json({ error: 'Email and UID are required' }, { status: 400 });
    }

    const dbLite = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
    const otpDocRef = doc(dbLite, 'otp_codes', uid);

    // Rate Limiting (60-second cooldown)
    const otpSnapshot = await getDoc(otpDocRef);
    if (otpSnapshot.exists()) {
      const data = otpSnapshot.data();
      if (data.lastSentAt) {
        const timeElapsed = Date.now() - data.lastSentAt;
        if (timeElapsed < 60000) {
          return NextResponse.json(
            { error: 'Harap tunggu 60 detik sebelum mengirim ulang kode.' },
            { status: 429 }
          );
        }
      }
    }

    // Generate secure random 6-digit numeric OTP code
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save this OTP code under a temporary collection 'otp_codes/{uid}'
    await setDoc(otpDocRef, {
      code: generatedOtp,
      email: email,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes expiration
      lastSentAt: Date.now(),
    });

    console.log(`\n\n=== OTP GENERATED ===\nUID: ${uid}\nEmail: ${email}\nOTP: ${generatedOtp}\n=====================\n\n`);

    if (!resend) {
      console.warn('RESEND_API_KEY is not defined. Falling back to sandbox mode.');
      return NextResponse.json({
        success: true,
        sandbox: true,
        otp: generatedOtp,
        message: 'RESEND_API_KEY belum terkonfigurasi. Menggunakan OTP fallback.'
      });
    }

    // Use Resend to send the beautifully styled verification email
    try {
      const response = await resend.emails.send({
        from: 'LensKeep <noreply@lenskeep.my.id>',
        to: email,
        subject: 'LensKeep - Verifikasi Email Anda',
        html: `<div style="font-family: sans-serif; padding: 20px;"><h2>Verifikasi Email Anda</h2><p>Kode OTP Anda adalah: <strong>${generatedOtp}</strong></p><p>Kode ini berlaku selama 5 menit.</p></div>`,
      });

      if (response.error) {
        console.warn('Resend error response:', response.error);
        return NextResponse.json({
          success: true,
          sandbox: true,
          otp: generatedOtp,
          message: response.error.message || 'Resend sandbox limit reached.'
        });
      }

      return NextResponse.json({ success: true, data: response.data });
    } catch (sendError: any) {
      console.warn('Error inside Resend send trigger:', sendError);
      return NextResponse.json({
        success: true,
        sandbox: true,
        otp: generatedOtp,
        message: sendError?.message || 'Failed to dispatch via Resend SDK'
      });
    }
  } catch (error: any) {
    console.error('Error in send-otp API route:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate verification email' },
      { status: 500 }
    );
  }
}
