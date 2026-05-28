import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/AuthContext'
import { LanguageProvider } from '@/lib/LanguageContext'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'LensKeep — Your Visual Mind Extension',
  description: 'An advanced OCR and AI Visual Analysis Engine powered by Gemini. Organize, search, and extract context from your screenshots seamlessly.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'LensKeep — Your Visual Mind Extension',
    description: 'An advanced OCR and AI Visual Analysis Engine powered by Gemini. Organize, search, and extract context from your screenshots seamlessly.',
    siteName: 'LensKeep',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="font-sans antialiased text-slate-900 bg-slate-50 min-h-screen">
        <AuthProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

