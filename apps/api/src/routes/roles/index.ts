import type { FastifyInstance } from 'fastify'
import { createRoleService } from '../../services/role.service.js'
import { authenticate } from '../../middleware/authenticate.js'

export async function roleRoutes(app: FastifyInstance) {
  const svc = createRoleService({ db: app.db, roleExtractQueue: app.roleExtractQueue })

  // POST /roles — employer creates role (triggers requirement extraction if githubRepoUrl set)
  app.post('/roles', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const body = req.body as {
      title: string
      descriptionText?: string
      domain?: string
      compensationMinUsd?: number
      compensationMaxUsd?: number
      remote?: boolean
      location?: string
      githubRepoUrl?: string
      figmaProjectUrl?: string
      blindMode?: boolean
    }
    if (!body.title) return reply.status(400).send({ error: 'title required' })
    try {
      const role = await svc.createRole(user.sub, body)
      return reply.status(201).send({ role })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // GET /roles — list employer's roles
  app.get('/roles', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const roles = await svc.listEmployerRoles(user.sub)
    return reply.send({ roles })
  })

  // GET /roles/:id — single role detail
  app.get('/roles/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const { id } = req.params as { id: string }
    const role = await app.db.role.findFirst({ where: { id, employerId: user.sub } })
    if (!role) return reply.status(404).send({ error: 'Role not found' })
    return reply.send({ role })
  })

  // GET /roles/:id/matches — top-50 FitScore matches (anonymized in blind mode)
  app.get('/roles/:id/matches', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const { id } = req.params as { id: string }
    const query = req.query as { limit?: string }
    try {
      const matches = await svc.getMatches(id, user.sub, parseInt(query.limit ?? '50', 10))
      return reply.send({ matches })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // POST /roles/:id/interest — employer expresses interest in a candidate
  app.post('/roles/:id/interest', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const { id } = req.params as { id: string }
    const { candidateId } = req.body as { candidateId: string }
    if (!candidateId) return reply.status(400).send({ error: 'candidateId required' })
    try {
      const result = await svc.expressInterest(id, user.sub, candidateId)
      return reply.send({ fitScore: result })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // POST /roles/:id/outcome — record hire outcome (feeds RL model)
  app.post('/roles/:id/outcome', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as {
      candidateId: string
      hired: boolean
      daysToHire?: number
      performanceRating90d?: number
      tenureMonths?: number
    }
    if (!body.candidateId) return reply.status(400).send({ error: 'candidateId required' })
    try {
      const outcome = await svc.recordHireOutcome(id, body.candidateId, body)
      return reply.status(201).send({ outcome })
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message: string }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  // GET /matches — candidate view of their FitScores across active roles
  app.get('/matches', { preHandler: [authenticate] }, async (req, reply) => {
    const user = (req as never as { currentUser: { sub: string } }).currentUser
    const fitScores = await app.db.storedFitScore.findMany({
      where: { candidateId: user.sub },
      orderBy: { overallScore: 'desc' },
      include: {
        role: {
          select: {
            id: true, title: true, domain: true, compensationMinUsd: true,
            compensationMaxUsd: true, remote: true, active: true,
          },
        },
      },
    })
    return reply.send({ matches: fitScores })
  })

  // GET /market/compensation — compensation intelligence
  app.get('/market/compensation', { preHandler: [authenticate] }, async (req, reply) => {
    const query = req.query as { role?: string; level?: string; geography?: string }
    const intel = await svc.getCompensationIntel(query)
    return reply.send({ intel })
  })
}
