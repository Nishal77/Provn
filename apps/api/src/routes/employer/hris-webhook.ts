import type { FastifyInstance } from 'fastify'
import { createHmac, timingSafeEqual } from 'crypto'

// HRIS webhook — handles employment event pushes from Workday and BambooHR.
// Employers configure the webhook URL in their HRIS with a shared secret.
// On receipt, we create/update EmploymentRecord and trigger co-sign request.

function verifyWorkdaySignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

function verifyBambooSignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('base64')
  try {
    return timingSafeEqual(Buffer.from(signature, 'base64'), Buffer.from(expected, 'base64'))
  } catch {
    return false
  }
}

export async function hrisWebhookRoutes(app: FastifyInstance) {
  // ── POST /employer/hris/workday ──────────────────────────────────────────
  // Workday pushes hire/terminate events via HTTP POST with HMAC-SHA256 sig.
  app.post(
    '/employer/hris/workday',
    { config: { rawBody: true } },
    async (req, reply) => {
      const rawBody = (req as any).rawBody as string | undefined
      const signature = (req.headers['x-workday-signature'] as string) ?? ''
      const employerDomain = (req.headers['x-attesta-domain'] as string) ?? ''

      const employer = await app.db.employer.findFirst({
        where: { domain: employerDomain, status: 'ACTIVE' },
        select: { id: true, name: true, hrisSecret: true },
      })

      if (!employer) {
        return reply.code(401).send({ error: 'Unknown employer domain' })
      }

      if (employer.hrisSecret && rawBody && signature) {
        const valid = verifyWorkdaySignature(rawBody, signature, employer.hrisSecret)
        if (!valid) {
          return reply.code(401).send({ error: 'Invalid signature' })
        }
      }

      const event = req.body as {
        eventType: 'HIRE' | 'TERMINATE' | 'PROMOTION' | 'TRANSFER'
        worker: { email: string; firstName: string; lastName: string }
        position: { jobTitle: string; department: string; startDate: string; endDate?: string }
        compensation?: { baseSalary: number; currency: string }
      }

      await _processHrisEvent(app, employer.id, event)

      return reply.code(200).send({ received: true })
    }
  )

  // ── POST /employer/hris/bamboohr ─────────────────────────────────────────
  // BambooHR webhooks use HMAC-SHA256 base64-encoded signature in header.
  app.post(
    '/employer/hris/bamboohr',
    { config: { rawBody: true } },
    async (req, reply) => {
      const rawBody = (req as any).rawBody as string | undefined
      const signature = (req.headers['x-bamboohr-signature-v1'] as string) ?? ''
      const employerDomain = (req.headers['x-attesta-domain'] as string) ?? ''

      const employer = await app.db.employer.findFirst({
        where: { domain: employerDomain, status: 'ACTIVE' },
        select: { id: true, name: true, hrisSecret: true },
      })

      if (!employer) {
        return reply.code(401).send({ error: 'Unknown employer domain' })
      }

      if (employer.hrisSecret && rawBody && signature) {
        const valid = verifyBambooSignature(rawBody, signature, employer.hrisSecret)
        if (!valid) {
          return reply.code(401).send({ error: 'Invalid signature' })
        }
      }

      // BambooHR payload uses different field names
      const event = req.body as {
        action: string
        employeeId: string
        fields: {
          firstName: { value: string }
          lastName: { value: string }
          workEmail: { value: string }
          jobTitle: { value: string }
          department: { value: string }
          hireDate: { value: string }
          terminationDate?: { value: string }
        }
      }

      const normalized = {
        eventType: (event.action === 'hired' ? 'HIRE' : event.action === 'terminated' ? 'TERMINATE' : 'HIRE') as 'HIRE' | 'TERMINATE',
        worker: {
          email: event.fields.workEmail.value,
          firstName: event.fields.firstName.value,
          lastName: event.fields.lastName.value,
        },
        position: {
          jobTitle: event.fields.jobTitle.value,
          department: event.fields.department.value,
          startDate: event.fields.hireDate.value,
          endDate: event.fields.terminationDate?.value,
        },
      }

      await _processHrisEvent(app, employer.id, normalized)

      return reply.code(200).send({ received: true })
    }
  )

  // ── GET /employer/hris/status ────────────────────────────────────────────
  // Employer can check HRIS integration status and webhook URL.
  app.get('/employer/hris/status', async (req, reply) => {
    const employerDomain = (req.headers['x-attesta-domain'] as string) ?? ''
    const employer = await app.db.employer.findFirst({
      where: { domain: employerDomain },
      select: { id: true, name: true, hrisConnected: true, hrisProvider: true },
    })

    if (!employer) {
      return reply.code(404).send({ error: 'Employer not found' })
    }

    return reply.send({
      connected: employer.hrisConnected ?? false,
      provider: employer.hrisProvider ?? null,
      webhookUrls: {
        workday: `https://api.attesta.io/employer/hris/workday`,
        bamboohr: `https://api.attesta.io/employer/hris/bamboohr`,
      },
      instructions: 'Set X-Attesta-Domain header to your verified domain. Store the shared secret from your ATTESTA employer dashboard.',
    })
  })
}

async function _processHrisEvent(
  app: FastifyInstance,
  employerId: string,
  event: {
    eventType: 'HIRE' | 'TERMINATE' | 'PROMOTION' | 'TRANSFER'
    worker: { email: string; firstName: string; lastName: string }
    position: { jobTitle: string; department: string; startDate: string; endDate?: string }
    compensation?: { baseSalary: number; currency: string }
  }
) {
  // Find candidate by email
  const candidate = await app.db.user.findUnique({
    where: { email: event.worker.email },
    select: { id: true, did: true, name: true },
  })

  if (!candidate) {
    // No matching ATTESTA user — log and skip (candidate may not have signed up yet)
    app.log.info({ event, employerId }, 'HRIS event: candidate not in ATTESTA — skipping')
    return
  }

  if (event.eventType === 'HIRE') {
    // Check for existing record to avoid duplicates
    const existing = await app.db.employmentRecord.findFirst({
      where: {
        candidateId: candidate.id,
        employerId,
        status: { not: 'CANCELLED' },
      },
    })

    if (!existing) {
      await app.db.employmentRecord.create({
        data: {
          candidateId: candidate.id,
          employerId,
          jobTitle: event.position.jobTitle,
          department: event.position.department,
          employmentType: 'FULL_TIME',
          startDate: new Date(event.position.startDate),
          status: 'PENDING_EMPLOYER',
        },
      })
      app.log.info({ candidateId: candidate.id, employerId }, 'HRIS HIRE: created employment record')
    }
  } else if (event.eventType === 'TERMINATE' && event.position.endDate) {
    await app.db.employmentRecord.updateMany({
      where: {
        candidateId: candidate.id,
        employerId,
        status: 'ANCHORED',
        endDate: null,
      },
      data: {
        endDate: new Date(event.position.endDate),
      },
    })
    app.log.info({ candidateId: candidate.id, employerId }, 'HRIS TERMINATE: updated end date')
  }
}
