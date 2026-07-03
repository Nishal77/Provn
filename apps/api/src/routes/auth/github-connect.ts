// GitHub OAuth connect — links a GitHub account to an existing ATTESTA user.
//
// Used in Phase 6 so we can read their repos/commits during skill evaluation.
// If user signed up with GitHub OAuth (Phase 1), their Account already has a
// GitHub accessToken — this route lets email/Google users also connect GitHub.
//
// Flow:
//   1. GET /auth/github/connect   → redirect to GitHub OAuth
//   2. GET /auth/github/callback  → exchange code → store in Account table

import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { env } from '../../config/env.js'

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'

export async function githubConnectRoutes(app: FastifyInstance) {
  // GET /auth/github/connect — redirect to GitHub OAuth
  app.get('/auth/github/connect', { preHandler: [authenticate] }, async (req, reply) => {
    const clientId = env.GITHUB_CLIENT_ID
    if (!clientId) {
      return reply.code(503).send({ success: false, error: { code: 'GITHUB_OAUTH_NOT_CONFIGURED' } })
    }

    // State = base64(userId|timestamp) — verified in callback
    const state = Buffer.from(`${req.currentUser.sub}|${Date.now()}`).toString('base64url')

    // Store state in Redis for 10 minutes to prevent CSRF
    await app.redis.set(`github_oauth_state:${state}`, req.currentUser.sub, 'EX', 600)

    const params = new URLSearchParams({
      client_id: clientId,
      scope: 'read:user,repo',
      state,
    })
    return reply.redirect(`${GITHUB_OAUTH_URL}?${params.toString()}`)
  })

  // GET /auth/github/callback — exchange code, save Account
  app.get('/auth/github/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string }
    if (!code || !state) {
      return reply.redirect('/dashboard?error=github_oauth_missing_params')
    }

    const userId = await app.redis.get(`github_oauth_state:${state}`)
    if (!userId) {
      return reply.redirect('/dashboard?error=github_oauth_invalid_state')
    }
    await app.redis.del(`github_oauth_state:${state}`)

    // Exchange code for access token
    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    })

    if (!tokenRes.ok) {
      return reply.redirect('/dashboard?error=github_token_exchange_failed')
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string
      token_type?: string
      scope?: string
      error?: string
    }

    if (tokenData.error || !tokenData.access_token) {
      return reply.redirect('/dashboard?error=github_token_denied')
    }

    // Fetch GitHub user ID
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'attesta-app' },
    })
    const githubUser = (await userRes.json()) as { id: number; login: string }

    // Upsert Account (create if not exists, update token if already connected)
    await app.db.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'GITHUB',
          providerAccountId: String(githubUser.id),
        },
      },
      create: {
        userId,
        type: 'oauth',
        provider: 'GITHUB',
        providerAccountId: String(githubUser.id),
        accessToken: tokenData.access_token,
        scope: tokenData.scope ?? 'read:user,repo',
      },
      update: {
        accessToken: tokenData.access_token,
        scope: tokenData.scope ?? 'read:user,repo',
      },
    })

    // Save GitHub username to profile
    await app.db.profile.updateMany({
      where: { userId },
      data: { githubUsername: githubUser.login },
    })

    return reply.redirect('/dashboard?github=connected')
  })
}
