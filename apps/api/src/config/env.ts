import { z } from 'zod'

// Validates all required environment variables at startup.
// If any are missing, the server refuses to start with a clear error.
// This prevents subtle "undefined" bugs in production.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // IPFS — Pinata (Phase 2+)
  PINATA_JWT: z.string().optional(),

  // Phase 3 — Onfido government ID verification
  ONFIDO_API_TOKEN: z.string().optional(),
  ONFIDO_WEBHOOK_SECRET: z.string().optional(),

  // Phase 3 — Polygon blockchain
  POLYGON_RPC_URL: z.string().url().optional(),
  MUMBAI_RPC_URL: z.string().url().optional(),
  DEPLOYER_PRIVATE_KEY: z.string().optional(), // 0x-prefixed hex private key
  DID_REGISTRY_ADDRESS: z.string().optional(), // deployed DIDRegistry.sol address

  // Frontend origin (used by Onfido SDK token referrer)
  WEB_URL: z.string().url().default('http://localhost:3000'),

  // Phase 4 — Stripe billing
  STRIPE_SECRET_KEY: z.string().optional(),         // sk_test_... or sk_live_...
  STRIPE_WEBHOOK_SECRET: z.string().optional(),     // whsec_...
  STRIPE_PRICE_PER_HIRE: z.string().optional(),     // price_... for $99/hire
  STRIPE_PRICE_SUBSCRIPTION: z.string().optional(), // price_... for $2K/month
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data

// Derive typed CORS origins array
export const corsOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim())
