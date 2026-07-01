import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { profileService } from '../../services/profile.service.js'

const updateBodySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  headline: z.string().max(160).optional(),
  bio: z.string().max(2000).optional(),
  location: z.string().max(100).optional(),
  timezone: z.string().max(60).optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  githubUsername: z.string().max(39).optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  isPublic: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
})

export async function meRoutes(app: FastifyInstance) {
  // GET /profile/me — get own full profile
  app.get('/me', { preHandler: [authenticate] }, async (req, reply) => {
    const { profile, user } = await profileService.getMyProfile(req.currentUser.sub)
    return reply.send({ success: true, data: { profile, user } })
  })

  // PUT /profile/me — update profile fields
  app.put('/me', { preHandler: [authenticate] }, async (req, reply) => {
    const parsed = updateBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
          field: parsed.error.issues[0]?.path[0] as string,
        },
      })
    }

    const profile = await profileService.updateProfile(req.currentUser.sub, parsed.data)
    return reply.send({ success: true, data: { profile } })
  })

  // GET /profile/me/completeness — completeness breakdown
  app.get('/me/completeness', { preHandler: [authenticate] }, async (req, reply) => {
    const breakdown = await profileService.getCompleteness(req.currentUser.sub)
    return reply.send({ success: true, data: breakdown })
  })
}
