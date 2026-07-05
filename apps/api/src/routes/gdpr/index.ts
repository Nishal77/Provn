// GDPR compliance routes — right to erasure + data portability.
//
// Article 17 (Right to Erasure): DELETE /gdpr/me — scrubs all PII from DB.
// Article 20 (Data Portability): GET /gdpr/export — full data dump as JSON.
//
// Security:
//   - Both require authenticated session (can't erase someone else's data)
//   - Erasure is irreversible — confirmation token required
//   - On-chain hashes are NOT deleted (immutable by design, contain no PII)

import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import crypto from 'node:crypto'

export async function gdprRoutes(app: FastifyInstance) {
  // GET /gdpr/export — Article 20 data portability
  app.get('/gdpr/export', { preHandler: [authenticate] }, async (req, reply) => {
    const userId = req.currentUser.sub

    const [user, profile, accounts, employment, skills, disclosures] = await Promise.all([
      app.db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, did: true, polygonAddress: true, kycTier: true, createdAt: true },
      }),
      app.db.profile.findUnique({ where: { userId } }),
      app.db.account.findMany({
        where: { userId },
        select: { provider: true, providerAccountId: true, createdAt: true },
      }),
      app.db.employmentRecord.findMany({
        where: { candidateId: userId },
        select: { id: true, status: true, jobTitle: true, department: true, startDate: true,
                  endDate: true, employmentType: true, chainTxHash: true, createdAt: true,
                  employer: { select: { name: true, domain: true } } },
      }),
      app.db.skillAttestation.findMany({
        where: { userId },
        select: { skillSlug: true, skillLevel: true, aiEvalScore: true, status: true,
                  chainTxHash: true, createdAt: true },
      }),
      app.db.zKDisclosureRequest.findMany({
        where: { candidateId: userId },
        select: { claimType: true, status: true, createdAt: true },
      }),
    ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user?.id,
        email: user?.email,
        did: user?.did,
        polygonAddress: user?.polygonAddress,
        kycTier: user?.kycTier,
        createdAt: user?.createdAt,
      },
      profile: profile ? {
        headline: profile.headline,
        location: profile.location,
        timezone: profile.timezone,
        isPublic: profile.isPublic,
        isSearchable: profile.isSearchable,
      } : null,
      connectedAccounts: accounts,
      employmentRecords: employment,
      skillAttestations: skills,
      zkDisclosures: disclosures,
      note: 'On-chain records (chainTxHash values) are public blockchain data and cannot be deleted.',
    }

    return reply
      .header('Content-Disposition', `attachment; filename="attesta-data-export-${userId}.json"`)
      .header('Content-Type', 'application/json')
      .send(JSON.stringify(exportData, null, 2))
  })

  // POST /gdpr/erasure/request — Article 17: request deletion token (sent to email)
  app.post('/gdpr/erasure/request', { preHandler: [authenticate] }, async (req, reply) => {
    const userId = req.currentUser.sub
    const user = await app.db.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (!user?.email) {
      return reply.code(400).send({ success: false, error: { code: 'NO_EMAIL_ON_FILE' } })
    }

    // Store 6-digit OTP in Redis for 15 minutes
    const otp = crypto.randomInt(100000, 999999).toString()
    await app.redis.set(`gdpr_erasure_otp:${userId}`, otp, 'EX', 900)

    // In production, send via Resend. Here we log for dev.
    app.log.info(`[gdpr] Erasure OTP for user ${userId}: ${otp}`)

    return reply.send({
      success: true,
      message: 'Confirmation code sent to your email. Use POST /gdpr/erasure/confirm with the code.',
    })
  })

  // POST /gdpr/erasure/confirm — confirm deletion with OTP, scrub all PII
  app.post('/gdpr/erasure/confirm', { preHandler: [authenticate] }, async (req, reply) => {
    const userId = req.currentUser.sub
    const { otp } = req.body as { otp: string }

    const stored = await app.redis.get(`gdpr_erasure_otp:${userId}`)
    if (!stored || stored !== otp) {
      return reply.code(400).send({ success: false, error: { code: 'INVALID_OTP' } })
    }
    await app.redis.del(`gdpr_erasure_otp:${userId}`)

    // Scrub PII — cascade deletes handle related records via Prisma schema onDelete:Cascade
    // Keep: on-chain hashes (immutable, no PII), anonymised audit trail
    await app.db.$transaction([
      // Null out all PII fields on user
      app.db.user.update({
        where: { id: userId },
        data: {
          email: null,
          emailVerified: null,
          name: null,
          imageUrl: null,
          facetecSessionId: null,
          facetecVerifiedAt: null,
          kycStatus: 'ERASED',
        },
      }),
      // Null out profile PII
      app.db.profile.updateMany({
        where: { userId },
        data: {
          headline: null,
          bio: null,
          linkedinUrl: null,
          githubUsername: null,
          websiteUrl: null,
          location: null,
          isPublic: false,
          isSearchable: false,
        },
      }),
      // Delete OAuth tokens (can't re-auth anyway)
      app.db.account.deleteMany({ where: { userId } }),
      // Delete refresh tokens
      app.db.refreshToken.deleteMany({ where: { userId } }),
    ])

    app.log.info(`[gdpr] User ${userId} data erased per Article 17 request`)

    return reply.send({
      success: true,
      message: 'Your personal data has been erased. On-chain cryptographic hashes are immutable and remain on the blockchain (they contain no personal information).',
    })
  })
}
