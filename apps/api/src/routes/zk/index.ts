import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { createZKDisclosureService } from '../../services/zk-disclosure.service.js'

export async function zkRoutes(app: FastifyInstance) {
  // POST /zk/request — employer requests a ZK disclosure from a candidate
  app.post('/zk/request', { preHandler: [authenticate] }, async (req, reply) => {
    const body = req.body as {
      candidateId: string
      claimType: 'SALARY_RANGE' | 'EMPLOYMENT_DURATION'
      claimParams: Record<string, number>
    }
    if (!body.candidateId || !body.claimType || !body.claimParams) {
      return reply.code(400).send({ success: false, error: { code: 'MISSING_FIELDS' } })
    }
    const svc = createZKDisclosureService({ db: app.db })
    try {
      const request = await svc.requestDisclosure(req.currentUser.sub, body)
      return reply.code(201).send({ success: true, data: request })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN'
      return reply.code(400).send({ success: false, error: { code: msg } })
    }
  })

  // GET /zk/requests — list disclosure requests for current user (as candidate or requester)
  app.get('/zk/requests', { preHandler: [authenticate] }, async (req, reply) => {
    const svc = createZKDisclosureService({ db: app.db })
    const { role } = req.query as { role?: string }
    const userId = req.currentUser.sub
    const records = role === 'requester'
      ? await svc.listForRequester(userId)
      : await svc.listForCandidate(userId)
    return reply.send({ success: true, data: records })
  })

  // GET /zk/requests/:id — single request
  app.get('/zk/requests/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const svc = createZKDisclosureService({ db: app.db })
    try {
      const record = await svc.getRequest(id, req.currentUser.sub)
      return reply.send({ success: true, data: record })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN'
      if (msg === 'NOT_FOUND') return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND' } })
      if (msg === 'FORBIDDEN') return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN' } })
      return reply.code(500).send({ success: false, error: { code: msg } })
    }
  })

  // POST /zk/requests/:id/decline — candidate declines a request
  app.post('/zk/requests/:id/decline', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const svc = createZKDisclosureService({ db: app.db })
    try {
      await svc.declineRequest(id, req.currentUser.sub)
      return reply.send({ success: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN'
      const code = msg === 'NOT_FOUND' ? 404 : msg === 'FORBIDDEN' ? 403 : 409
      return reply.code(code).send({ success: false, error: { code: msg } })
    }
  })

  // POST /zk/requests/:id/prove — candidate submits Groth16 proof (generated client-side)
  app.post('/zk/requests/:id/prove', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as {
      proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[]; protocol: string; curve: string }
      publicSignals: string[]
    }
    if (!body.proof || !body.publicSignals) {
      return reply.code(400).send({ success: false, error: { code: 'MISSING_PROOF' } })
    }
    const svc = createZKDisclosureService({ db: app.db })
    try {
      const result = await svc.submitProof(req.currentUser.sub, {
        requestId: id,
        proof: body.proof,
        publicSignals: body.publicSignals,
      })
      return reply.send({ success: true, data: result })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN'
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404, FORBIDDEN: 403, ALREADY_PROCESSED: 409, EXPIRED: 410,
      }
      return reply.code(statusMap[msg] ?? 500).send({ success: false, error: { code: msg } })
    }
  })
}
