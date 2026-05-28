import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

let otpMockStorage = new Map<string, string>();

declare global {
  var otpCache: Map<string, string> | undefined;
}

if (process.env.NODE_ENV !== 'production') {
  if (!global.otpCache) {
    global.otpCache = new Map<string, string>();
  }
  otpMockStorage = global.otpCache;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email missing' }, { status: 400 });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpMockStorage.set(email, code);

    console.log(`\n\n=== OTP MOCK ===\nGenerated OTP: ${code} for email: ${email}\n=================\n\n`);

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'onboarding@resend.dev', // Default testing address, users can change to their verified domains
      to: email,
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Verify your email address</h2>
          <p>Your verification code is: <strong>${code}</strong></p>
          <p>This code will expire shortly.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: 'OTP sent successfully' });
  } catch (err: any) {
    console.error('--- SEND OTP ERROR ---');
    console.error('Full Error Object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    return NextResponse.json({ error: 'Failed to send OTP', details: err?.message || 'Unknown' }, { status: 500 });
  }
}
