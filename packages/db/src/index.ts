export { db } from './client'

// Re-export Prisma types so consumers don't need @prisma/client directly
export type {
  Prisma,
  PrismaClient,
  User,
  Account,
  Session,
  Profile,
  RefreshToken,
  VerificationToken,
  VerificationTier,
  AuthProvider,
} from '@prisma/client'
