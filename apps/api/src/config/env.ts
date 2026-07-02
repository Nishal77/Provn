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

  // Phase 3 — FaceTec 3D liveness (Step 1 of KYC, ISO 30107-3)
  // Dev: FaceTec Managed Testing server. Prod: self-hosted FaceTec App Server.
  FACETEC_SERVER_URL: z.string().url().optional(),
  FACETEC_DEVICE_KEY_IDENTIFIER: z.string().optional(),
  FACETEC_FACE_SCAN_ENCRYPTION_KEY: z.string().optional(), // RSA public key PEM

  // Phase 3 — Onfido government ID verification (Step 2 — document only)
  ONFIDO_API_TOKEN: z.string().optional(),
  ONFIDO_WEBHOOK_SECRET: z.string().optional(),

  // Phase 3 — Polygon blockchain
  POLYGON_RPC_URL: z.string().url().optional(),
  MUMBAI_RPC_URL: z.string().url().optional(),
  DEPLOYER_PRIVATE_KEY: z.string().optional(), // 0x-prefixed hex private key
  // Set after deployment (see packages/contracts/README-deploy.md)
  DID_REGISTRY_ADDRESS: z.string().optional(),         // active network address (used at runtime)
  MUMBAI_DID_REGISTRY_ADDRESS: z.string().optional(),  // testnet — set after deploy:mumbai
  POLYGON_DID_REGISTRY_ADDRESS: z.string().optional(), // mainnet — set after deploy:polygon
  POLYGONSCAN_API_KEY: z.string().optional(),          // for contract source verification

  // Frontend origin (used by Onfido SDK token referrer)
  WEB_URL: z.string().url().default('http://localhost:3000'),

  // Phase 4 — Stripe billing
  STRIPE_SECRET_KEY: z.string().optional(),             // sk_test_... or sk_live_...
  // Without this, constructEvent() is skipped — attackers can forge Stripe events (fake payments).
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET required — whsec_... from Stripe Dashboard → Webhooks'),
  STRIPE_PRICE_PER_HIRE: z.string().optional(),         // price_... for $99/hire
  STRIPE_PRICE_SUBSCRIPTION: z.string().optional(),     // price_... for $2K/month
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data

// Derive typed CORS origins array
export const corsOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim())
