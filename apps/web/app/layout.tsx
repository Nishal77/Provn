import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '../components/providers'
import '@attesta/ui/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'ATTESTA — Trust Infrastructure for Professional Work',
    template: '%s | ATTESTA',
  },
  description:
    'Cryptographically verified professional credentials. Replace resumes, ATS, and interviews with trustworthy proof of work.',
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
