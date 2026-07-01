import NextAuth, { type DefaultSession } from 'next-auth'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import Resend from 'next-auth/providers/resend'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from '@attesta/db'
import type { VerificationTier } from '@attesta/shared'

// Extend Auth.js types so our custom fields appear on session.user
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      did: string | null
      kycTier: VerificationTier
      polygonAddress: string | null
    } & DefaultSession['user']
  }

  // Extend the User type to carry ATTESTA fields through the adapter
  interface User {
    did?: string | null
    kycTier?: string | null
    polygonAddress?: string | null
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Sessions stored in PostgreSQL for server-side invalidation capability
  adapter: PrismaAdapter(db) as never, // cast needed: prisma-adapter/next-auth minor version delta

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.EMAIL_FROM ?? 'no-reply@attesta.io',
    }),
  ],

  callbacks: {
    // Include ATTESTA fields in the browser session
    session({ session, user }) {
      session.user.id = user.id
      session.user.did = (user.did as string | null | undefined) ?? null
      session.user.kycTier = ((user.kycTier as string | null | undefined) ?? 'T6_SELF') as VerificationTier
      session.user.polygonAddress = (user.polygonAddress as string | null | undefined) ?? null
      return session
    },
  },

  // After sign-up via OAuth, create a ProofWork profile automatically
  events: {
    async createUser({ user }) {
      if (!user.id) return
      await db.profile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, completenessScore: 10 },
      })
    },
  },

  pages: {
    signIn: '/login',
    error: '/login', // Auth errors redirect to login with ?error= query param
  },
})
