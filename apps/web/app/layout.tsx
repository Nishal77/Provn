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
    default: 'ATTESTA — Resumes are fiction. This is nonfiction.',
    template: '%s | ATTESTA',
  },
  description:
    'Anyone can write a resume. ATTESTA turns your work history, skills, and references into co-signed, on-chain proof — verified in seconds, impossible to fake.',
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
