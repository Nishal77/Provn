import { PrismaClient } from '@prisma/client'

// WHY global singleton: Next.js hot-reload creates multiple module instances
// in development. Without this, every hot reload opens a new DB connection,
// quickly exhausting the PostgreSQL connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
