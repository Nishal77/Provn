import { db } from '@attesta/db'
import type { FastifyInstance } from 'fastify'
import { createId } from '@paralleldrive/cuid2'
import { hashPassword, comparePassword } from '../utils/password.js'
import { hashToken, generateSecureToken, generateNonce } from '../utils/token.js'
import type { AuthResponse } from '@attesta/shared'

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days
const SIWE_NONCE_TTL_SECONDS = 5 * 60 // 5 minutes

export function createAuthService(app: FastifyInstance) {
  return {
    // ── Email/Password ────────────────────────────────────────

    async signup(input: {
      email: string
      name: string
      password: string
      ip?: string
      userAgent?: string
    }): Promise<{ response: AuthResponse; rawRefreshToken: string }> {
      const existing = await db.user.findUnique({ where: { email: input.email } })
      if (existing) {
        const err = new Error('EMAIL_ALREADY_EXISTS')
        err.name = 'ConflictError'
        throw err
      }

      const passwordHash = await hashPassword(input.password)

      const user = await db.user.create({
        data: {
          email: input.email,
          name: input.name,
          accounts: {
            create: {
              type: 'credentials',
              provider: 'EMAIL',
              providerAccountId: input.email,
              // Store password hash as accessToken for the EMAIL provider
              accessToken: passwordHash,
            },
          },
          profile: {
            create: {
              completenessScore: 10, // +10 for providing email
            },
          },
        },
      })

      return this._issueTokens(user, input)
    },

    async login(input: {
      email: string
      password: string
      ip?: string
      userAgent?: string
    }): Promise<{ response: AuthResponse; rawRefreshToken: string }> {
      const user = await db.user.findUnique({
        where: { email: input.email },
        include: {
          accounts: { where: { provider: 'EMAIL' } },
        },
      })

      // Return the same error for "user not found" and "wrong password"
      // to prevent user enumeration attacks
      const account = user?.accounts[0]
      if (!user || !account?.accessToken) {
        const err = new Error('INVALID_CREDENTIALS')
        err.name = 'UnauthorizedError'
        throw err
      }

      const valid = await comparePassword(input.password, account.accessToken)
      if (!valid) {
        const err = new Error('INVALID_CREDENTIALS')
        err.name = 'UnauthorizedError'
        throw err
      }

      return this._issueTokens(user, input)
    },

    // ── Token Rotation ────────────────────────────────────────

    async refresh(rawRefreshToken: string): Promise<{
      response: AuthResponse
      rawRefreshToken: string
    }> {
      const tokenHash = hashToken(rawRefreshToken)

      const storedToken = await db.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      })

      if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
        const err = new Error('INVALID_REFRESH_TOKEN')
        err.name = 'UnauthorizedError'
        throw err
      }

      // Immediately revoke old token (token rotation — prevents replay)
      await db.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date(), revokedReason: 'rotated' },
      })
      await app.redis.del(`refresh:${storedToken.id}`)

      return this._issueTokens(storedToken.user, {})
    },

    async logout(rawRefreshToken: string): Promise<void> {
      const tokenHash = hashToken(rawRefreshToken)
      const stored = await db.refreshToken.findUnique({ where: { tokenHash } })
      if (!stored) return // Already gone — idempotent logout

      await db.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), revokedReason: 'logout' },
      })
      await app.redis.del(`refresh:${stored.id}`)
    },

    // ── SIWE (Sign-In With Ethereum) ───────────────────────────

    async createSiweChallenge(address: string) {
      const nonce = generateNonce()
      const issuedAt = new Date()
      const expiresAt = new Date(issuedAt.getTime() + SIWE_NONCE_TTL_SECONDS * 1000)

      // Store nonce in Redis — keyed by wallet address
      await app.redis.setex(`siwe:nonce:${address.toLowerCase()}`, SIWE_NONCE_TTL_SECONDS, nonce)

      return {
        nonce,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      }
    },

    async verifySiweSignature(
      address: string,
      message: string,
      signature: string
    ): Promise<{ response: AuthResponse; rawRefreshToken: string }> {
      // Retrieve stored nonce
      const storedNonce = await app.redis.get(`siwe:nonce:${address.toLowerCase()}`)
      if (!storedNonce) {
        const err = new Error('SIWE_NONCE_EXPIRED')
        err.name = 'UnauthorizedError'
        throw err
      }

      // Verify signature using viem
      const { verifyMessage } = await import('viem')
      const isValid = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      })

      if (!isValid) {
        const err = new Error('SIWE_INVALID_SIGNATURE')
        err.name = 'UnauthorizedError'
        throw err
      }

      // Consume nonce (one-time use)
      await app.redis.del(`siwe:nonce:${address.toLowerCase()}`)

      // Upsert user by wallet address
      const user = await db.user.upsert({
        where: { polygonAddress: address.toLowerCase() },
        update: {},
        create: {
          polygonAddress: address.toLowerCase(),
          accounts: {
            create: {
              type: 'siwe',
              provider: 'SIWE',
              providerAccountId: address.toLowerCase(),
            },
          },
          profile: {
            create: {
              completenessScore: 5,
            },
          },
        },
      })

      return this._issueTokens(user, {})
    },

    // ── Internal Helpers ──────────────────────────────────────

    async _issueTokens(
      user: { id: string; did: string | null; kycTier: string; email: string | null; name: string | null; imageUrl: string | null; polygonAddress: string | null },
      _meta: { ip?: string; userAgent?: string }
    ): Promise<{ response: AuthResponse; rawRefreshToken: string }> {
      const rawRefreshToken = generateSecureToken()
      const tokenHash = hashToken(rawRefreshToken)
      const tokenId = createId()

      const expiresAt = new Date()
      expiresAt.setSeconds(expiresAt.getSeconds() + REFRESH_TTL_SECONDS)

      await db.refreshToken.create({
        data: {
          id: tokenId,
          userId: user.id,
          tokenHash,
          expiresAt,
          userAgent: _meta.userAgent,
          ipAddress: _meta.ip,
        },
      })

      // Mirror in Redis for fast validity checks
      await app.redis.setex(`refresh:${tokenId}`, REFRESH_TTL_SECONDS, user.id)

      // Sign access token (15 min) — payload identifies user without any PII
      const accessToken = app.jwt.sign({
        sub: user.id,
        did: user.did,
        tier: user.kycTier,
      })

      return {
        rawRefreshToken,
        response: {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            imageUrl: user.imageUrl,
            kycTier: user.kycTier as never,
            did: user.did,
          },
        },
      }
    },
  }
}
