import React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Preview,
  Tailwind,
  Hr,
} from '@react-email/components';

interface VerificationEmailProps {
  otp: string;
}

export const VerificationEmail = ({ otp = '123456' }: VerificationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Verifikasi Email Anda - LensKeep</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brand: '#4f46e5', // Indigo-600
              },
            },
          },
        }}
      >
        <Body className="bg-slate-900 text-slate-100 font-sans my-auto mx-auto px-2">
          <Container className="border border-slate-800 rounded-lg my-[40px] mx-auto p-[20px] max-w-[465px] bg-slate-950/50">
            <Section className="mt-[32px] mb-[24px]">
              <Text className="text-white text-[24px] font-black tracking-tighter text-center m-0">
                LensKeep
              </Text>
            </Section>
            
            <Heading className="text-white text-[24px] font-bold text-center p-0 my-[30px] mx-0">
              Verifikasi Email Anda
            </Heading>
            
            <Text className="text-slate-300 text-[14px] leading-[24px] mb-[24px] text-center">
              Berikut adalah kode One-Time Password (OTP) Anda untuk memverifikasi akun Anda.
            </Text>

            <Section className="bg-slate-800 rounded-xl p-[24px] mb-[24px] border border-slate-700">
              <Text className="text-indigo-400 text-[32px] font-black tracking-[0.25em] text-center m-0 font-mono">
                {otp}
              </Text>
            </Section>

            <Text className="text-slate-400 text-[14px] leading-[24px] text-center">
              Kode ini akan kedaluwarsa dalam waktu singat. Jangan bagikan kode ini kepada siapa pun.
            </Text>

            <Hr className="border border-slate-800 my-[26px] mx-0 w-full" />
            
            <Text className="text-slate-500 text-[12px] leading-[24px] text-center">
              Jika Anda tidak meminta email ini, abaikan saja. Kode ini akan kedaluwarsa dalam waktu singkat.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default VerificationEmail;
