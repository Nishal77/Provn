import crypto from 'node:crypto'
import dns from 'node:dns/promises'
import type { PrismaClient } from '@attesta/db'

interface EmployerServiceDeps {
  db: PrismaClient
}

export interface RegisterEmployerInput {
  adminUserId: string
  name: string
  domain: string
  website?: string
  industry?: string
  size?: string
  billingEmail: string
}

export function createEmployerService({ db }: EmployerServiceDeps) {

  async function registerEmployer(input: RegisterEmployerInput) {
    const domain = input.domain.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0]!

    const existing = await db.employer.findUnique({ where: { domain } })
    if (existing) {
      throw Object.assign(new Error('Domain already registered'), { code: 'DOMAIN_TAKEN' })
    }

    // Generate DNS TXT verification token
    const token = `attesta-verify=${crypto.randomBytes(32).toString('hex')}`

    const employer = await db.employer.create({
      data: {
        name: input.name,
        domain,
        website: input.website,
        industry: input.industry,
        size: input.size,
        billingEmail: input.billingEmail,
        adminUserId: input.adminUserId,
        status: 'PENDING',
        domainVerifications: {
          create: { domain, token },
        },
      },
      include: { domainVerifications: true },
    })

    return {
      employer,
      verificationToken: token,
      dnsInstructions: {
        recordType: 'TXT',
        hostname: `_attesta.${domain}`,
        value: token,
        ttl: 300,
      },
    }
  }

  async function verifyDomain(employerId: string): Promise<{ verified: boolean; employer?: object }> {
    const employer = await db.employer.findUniqueOrThrow({
      where: { id: employerId },
      include: {
        domainVerifications: {
          where: { verified: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    const pending = employer.domainVerifications[0]
    if (!pending) {
      // Already verified
      return { verified: true, employer }
    }

    await db.employerDomainVerification.update({
      where: { id: pending.id },
      data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
    })

    let found = false
    try {
      const records = await dns.resolveTxt(`_attesta.${employer.domain}`)
      const flat = records.flat()
      found = flat.some((r) => r === pending.token)
    } catch {
      // DNS failure — not verified yet
    }

    if (!found) return { verified: false }

    const updated = await db.$transaction([
      db.employerDomainVerification.update({
        where: { id: pending.id },
        data: { verified: true, verifiedAt: new Date() },
      }),
      db.employer.update({
        where: { id: employerId },
        data: { status: 'ACTIVE' },
      }),
    ])

    return { verified: true, employer: updated[1] }
  }

  async function getEmployerForUser(userId: string) {
    return db.employer.findFirst({
      where: { adminUserId: userId },
      include: {
        domainVerifications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
  }

  async function handleStripeWebhook(event: { type: string; data: { object: Record<string, unknown> } }) {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const employerId = (session.metadata as Record<string, string>)?.employerId
      const plan = (session.metadata as Record<string, string>)?.plan as 'PER_HIRE' | 'SUBSCRIPTION'

      if (!employerId) return

      const updateData: Record<string, unknown> = {
        stripePlan: plan,
        stripeCustomerId: session.customer as string,
      }

      if (plan === 'SUBSCRIPTION') {
        updateData.stripeSubscriptionId = session.subscription as string
      }

      await db.employer.update({
        where: { id: employerId },
        data: updateData,
      })
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object
      await db.employer.updateMany({
        where: { stripeSubscriptionId: sub.id as string },
        data: {
          status: 'SUSPENDED',
          stripeSubscriptionId: null,
          stripePlan: 'PER_HIRE',
        },
      })
    }
  }

  return { registerEmployer, verifyDomain, getEmployerForUser, handleStripeWebhook }
}

export type EmployerService = ReturnType<typeof createEmployerService>
