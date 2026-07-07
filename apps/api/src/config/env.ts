import { z } from 'zod'

// Validates all required environment variables at startup.
// If any are missing, the server refuses to start with a clear error.
// This prevents subtle "undefined" bugs in production.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_REGION: z.string().default('us-east-1'), // data residency header for GDPR/DPDP routing

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

  // Phase 3 — Veriff government ID verification (Step 2 — document + selfie)
  VERIFF_API_KEY: z.string().optional(),      // Veriff API key (public) — console.veriff.com
  VERIFF_PRIVATE_KEY: z.string().optional(),  // Veriff private key (for HMAC signing)

  // Phase 3 — Polygon blockchain (use Alchemy: alchemy.com → Create App → Polygon)
  // Format: https://polygon-mainnet.g.alchemy.com/v2/<key>
  POLYGON_RPC_URL: z.string().url().optional(),
  // Polygon Amoy testnet: https://polygon-amoy.g.alchemy.com/v2/<key>
  AMOY_RPC_URL: z.string().url().optional(),
  DEPLOYER_PRIVATE_KEY: z.string().optional(), // 0x-prefixed hex private key
  // Set after deployment (see packages/contracts/README-deploy.md)
  DID_REGISTRY_ADDRESS: z.string().optional(),         // active network address (used at runtime)
  AMOY_DID_REGISTRY_ADDRESS: z.string().optional(),   // testnet — set after deploy:amoy
  POLYGON_DID_REGISTRY_ADDRESS: z.string().optional(), // mainnet — set after deploy:polygon
  POLYGONSCAN_API_KEY: z.string().optional(),          // for contract source verification

  // Frontend origin (used by Veriff callback URL)
  WEB_URL: z.string().url().default('http://localhost:3000'),

  // Phase 5 — Resend transactional email (co-sign requests, anchor confirmations)
  RESEND_API_KEY: z.string().optional(), // re_... — get from resend.com dashboard

  // Phase 7 — ZK Verifier contract addresses (set after deploy-verifiers.ts)
  SALARY_RANGE_VERIFIER_ADDRESS: z.string().optional(),
  EMPLOYMENT_VERIFIER_ADDRESS: z.string().optional(),

  // Phase 6 — GitHub OAuth (connect existing accounts for repo analysis)
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // Phase 6 — AI service + Groq (Llama 3.1 70B via OpenAI-compatible API)
  AI_SERVICE_URL: z.string().url().default('http://localhost:5000'),
  GROQ_API_KEY: z.string().optional(),            // console.groq.com
  ANTHROPIC_API_KEY: z.string().optional(),       // console.anthropic.com (design eval)

  // Phase 9 — Cloudflare R2 (trial recordings + artifacts, S3-compatible, zero egress)
  // Get at dash.cloudflare.com → R2 → Create bucket
  R2_ACCOUNT_ID: z.string().optional(),           // Cloudflare account ID
  R2_ACCESS_KEY_ID: z.string().optional(),        // R2 API token → Access Key ID
  R2_SECRET_ACCESS_KEY: z.string().optional(),    // R2 API token → Secret Access Key
  R2_BUCKET_NAME: z.string().default('attesta-dev'),
  R2_PUBLIC_URL: z.string().optional(),           // optional public bucket URL or custom domain

  // Phase 10 — Pinecone vector DB (2048-dim candidate capability vectors)
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_ENVIRONMENT: z.string().default('us-east-1-aws'),
  PINECONE_INDEX: z.string().default('attesta-candidates'),

  // Phase 9 — Judge0 sandbox (self-hosted)
  JUDGE0_URL: z.string().url().optional(),              // e.g. https://judge0.attesta.io
  JUDGE0_AUTH_TOKEN: z.string().optional(),             // X-Auth-Token header

  // Phase 9 — Stripe Connect (candidate payouts)
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),      // ca_... from Stripe Dashboard

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
