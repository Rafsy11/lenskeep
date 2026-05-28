import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import VerificationEmail from '@/components/emails/VerificationEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    const data = await resend.emails.send({
      from: 'LensKeep Security <no-reply@lenskeep.my.id>',
      to: email,
      subject: 'Your LensKeep Verification Code',
      react: VerificationEmail({ otp }),
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}
