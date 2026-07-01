// Development seed — creates a test user so you can log in immediately.
// Run: pnpm db:seed
// Only run in development — the NODE_ENV check prevents accidents.

import { db } from './client'

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Never run seed in production')
  }

  console.log('🌱 Seeding database...')

  const user = await db.user.upsert({
    where: { email: 'dev@attesta.io' },
    update: {},
    create: {
      email: 'dev@attesta.io',
      name: 'Dev User',
      emailVerified: new Date(),
      profile: {
        create: {
          headline: 'Full-Stack Engineer',
          completenessScore: 20,
        },
      },
    },
  })

  console.log(`✅ Seeded user: ${user.email} (id: ${user.id})`)
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
