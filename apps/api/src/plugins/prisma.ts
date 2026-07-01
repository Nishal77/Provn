import fp from 'fastify-plugin'
import { db } from '@attesta/db'

// Extend Fastify's type system so app.db is typed everywhere
declare module 'fastify' {
  interface FastifyInstance {
    db: typeof db
  }
}

export const prismaPlugin = fp(async (app) => {
  await db.$connect()

  app.decorate('db', db)

  app.addHook('onClose', async () => {
    await db.$disconnect()
  })
})
