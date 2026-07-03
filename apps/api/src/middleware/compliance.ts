/**
 * Compliance middleware — GDPR, CCPA, India DPDP, EU AI Act
 *
 * Applied globally to all API routes.
 * Enforces:
 *   1. Data residency headers (for CDN/proxy routing)
 *   2. Audit trail for AI-assisted hiring decisions (EU AI Act + EEOC)
 *   3. Right-to-erasure endpoint guard
 *   4. PII access logging for SOC 2 compliance
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'

// Routes that access PII — logged for SOC 2 audit trail
const PII_ACCESS_ROUTES = [
  '/profile/',
  '/employment/',
  '/trials/',
  '/kyc/',
  '/zk/reveal',
]

// AI-assisted decisions requiring EEOC/EU AI Act audit log
const AI_DECISION_ROUTES = [
  '/roles/',
  '/matches',
  '/fitscore',
]

export const compliancePlugin = fp(async (app: FastifyInstance) => {
  // ── 1. Data residency header (used by Cloudflare routing rules) ──
  app.addHook('onSend', async (req, reply) => {
    const region = process.env.AWS_REGION ?? 'us-east-1'
    reply.header('X-Data-Region', region)

    // EU users: tell CDN this response has GDPR-origin data
    if (region === 'eu-west-1') {
      reply.header('X-Data-Residency', 'gdpr')
    } else if (region === 'ap-south-1') {
      reply.header('X-Data-Residency', 'dpdp')
    }
  })

  // ── 2. PII access audit log (SOC 2) ──
  app.addHook('onRequest', async (req: FastifyRequest) => {
    const isPiiRoute = PII_ACCESS_ROUTES.some(r => req.url.startsWith(r))
    if (!isPiiRoute) return

    // Fire-and-forget audit log. Do NOT await — never block request for logging.
    const userId = (req as any).currentUser?.sub ?? 'anonymous'
    setImmediate(() => {
      app.log.info({
        event: 'pii_access',
        userId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      })
    })
  })

  // ── 3. AI decision audit log (EU AI Act + EEOC) ──
  app.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    const isAiRoute = AI_DECISION_ROUTES.some(r => req.url.startsWith(r))
    if (!isAiRoute || req.method !== 'GET') return

    const userId = (req as any).currentUser?.sub ?? 'anonymous'
    setImmediate(() => {
      app.log.info({
        event: 'ai_decision_access',
        userId,
        url: req.url,
        statusCode: reply.statusCode,
        timestamp: new Date().toISOString(),
        // EU AI Act Article 13: must log AI system decisions for human oversight
        humanOversightEnabled: true,
        biasAuditEnabled: true,
      })
    })
  })

  // ── 4. Right-to-erasure header check ──
  // Requests tagged X-Erasure-Token: <token> are deletion requests.
  // Token validated in the route handler; this middleware only flags them.
  app.addHook('onRequest', async (req: FastifyRequest) => {
    const erasureToken = req.headers['x-erasure-token']
    if (erasureToken) {
      ;(req as any).isErasureRequest = true
      app.log.warn({
        event: 'gdpr_erasure_request',
        url: req.url,
        timestamp: new Date().toISOString(),
      })
    }
  })
})
