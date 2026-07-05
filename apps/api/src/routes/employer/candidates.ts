import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'

export async function employerCandidatesRoute(app: FastifyInstance) {
  app.get('/employer/candidates', { preHandler: [authenticate] }, async (req, reply) => {
    const { skill, tier, q, page = '1', limit = '30' } = req.query as {
      skill?: string; tier?: string; q?: string; page?: string; limit?: string
    }

    const pageNum = Math.max(1, parseInt(page, 10))
    const take = Math.min(50, Math.max(1, parseInt(limit, 10)))
    const skip = (pageNum - 1) * take

    const candidates = await app.db.profile.findMany({
      where: {
        isPublic: true,
        isSearchable: true,
        ...(q ? {
          OR: [
            { headline: { contains: q, mode: 'insensitive' } },
            { user: { name: { contains: q, mode: 'insensitive' } } },
          ],
        } : {}),
        ...(tier ? { user: { kycTier: tier as never } } : {}),
        ...(skill ? {
          user: {
            skillAttestations: {
              some: { skillSlug: skill.toLowerCase(), status: 'ANCHORED' },
            },
          },
        } : {}),
      },
      select: {
        user: {
          select: {
            did: true,
            kycTier: true,
            name: true,
            imageUrl: true,
            skillAttestations: {
              where: { status: 'ANCHORED' },
              select: { skillSlug: true, skillLevel: true },
              orderBy: { skillLevel: 'desc' },
              take: 6,
            },
          },
        },
        headline: true,
        overallTrustScore: true,
      },
      skip,
      take,
      orderBy: { overallTrustScore: 'desc' },
    })

    const data = candidates.map((p) => ({
      did: p.user.did,
      kycTier: p.user.kycTier,
      fullName: p.user.name,
      avatarUrl: p.user.imageUrl,
      headline: p.headline,
      trustScore: Number(p.overallTrustScore ?? 0),
      skills: p.user.skillAttestations,
    }))

    return reply.send({ success: true, data, page: pageNum })
  })
}
