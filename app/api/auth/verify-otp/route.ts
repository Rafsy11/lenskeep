import { NextRequest, NextResponse } from 'next/server';

let otpMockStorage = new Map<string, string>();

declare global {
  var otpCache: Map<string, string> | undefined;
}

if (process.env.NODE_ENV !== 'production') {
  otpMockStorage = global.otpCache || new Map<string, string>();
}

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    
    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const storedCode = otpMockStorage.get(email);
    
    if (!storedCode || storedCode !== code) {
      return NextResponse.json({ error: 'Invalid or expired OTP code' }, { status: 400 });
    }

    otpMockStorage.delete(email); // consume successfully verified code

    return NextResponse.json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    console.error('Verify OTP Error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
