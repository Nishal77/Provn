// Employment co-sign service — owns the full state machine lifecycle.
//
// State machine:
//   PENDING_EMPLOYER → SIGNED → ANCHORING → ANCHORED
//                            ↘ (if employer rejects) REJECTED
//   PENDING_EMPLOYER → (if candidate cancels) CANCELLED
//
// The employer never needs an ATTESTA account. They receive a one-time 32-byte
// hex token via email, click a link, and confirm or reject the record. The token
// is nulled out after use so it cannot be replayed.

import crypto from 'node:crypto'
import type { PrismaClient } from '@attesta/db'
import type { Queue } from 'bullmq'
import { sendCountersignRequest } from './email.service.js'
import { env } from '../config/env.js'

// 7 days before the countersign link expires
const COUNTERSIGN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface CreateEmploymentRecordInput {
  jobTitle: string
  department?: string
  startDate: Date
  endDate?: Date
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE'
  employerId: string
}

export function createEmploymentService(deps: {
  db: PrismaClient
  anchorQueue: Queue
}) {
  const { db, anchorQueue } = deps

  // ── createRecord ──────────────────────────────────────────────────────────
  // Candidate initiates the co-sign flow. Validates the employer is active,
  // prevents exact duplicate records, generates a one-time countersign token,
  // and emails the employer's billing contact.
  async function createRecord(candidateId: string, input: CreateEmploymentRecordInput) {
    const employer = await db.employer.findUnique({
      where: { id: input.employerId },
      select: { id: true, name: true, billingEmail: true, status: true },
    })
    if (!employer) throw new Error('EMPLOYER_NOT_FOUND')
    if (employer.status !== 'ACTIVE') throw new Error('EMPLOYER_NOT_ACTIVE')

    const candidate = await db.user.findUnique({
      where: { id: candidateId },
      select: { id: true, name: true },
    })
    if (!candidate) throw new Error('CANDIDATE_NOT_FOUND')

    // Block exact duplicates (same candidate + employer + title + start date still in-flight)
    const duplicate = await db.employmentRecord.findFirst({
      where: {
        candidateId,
        employerId: input.employerId,
        jobTitle: input.jobTitle,
        startDate: input.startDate,
        status: { in: ['PENDING_EMPLOYER', 'SIGNED', 'ANCHORING', 'ANCHORED'] },
      },
    })
    if (duplicate) throw new Error('DUPLICATE_RECORD')

    const countersignToken = crypto.randomBytes(32).toString('hex')
    const countersignTokenExpiresAt = new Date(Date.now() + COUNTERSIGN_TTL_MS)

    const record = await db.employmentRecord.create({
      data: {
        candidateId,
        employerId: input.employerId,
        jobTitle: input.jobTitle,
        department: input.department ?? null,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        employmentType: input.employmentType,
        candidateSignedAt: new Date(),
        countersignToken,
        countersignTokenExpiresAt,
        status: 'PENDING_EMPLOYER',
      },
      include: { employer: { select: { name: true } } },
    })

    const candidateName = candidate.name ?? 'A professional'
    const webUrl = env.WEB_URL ?? 'https://attesta.io'
    const countersignUrl = `${webUrl}/employment/countersign/${countersignToken}`

    if (employer.billingEmail) {
      await sendCountersignRequest({
        toEmail: employer.billingEmail,
        candidateName,
        jobTitle: input.jobTitle,
        employerName: employer.name,
        countersignUrl,
        expiresAt: countersignTokenExpiresAt,
      })
    }

    return record
  }

  // ── getRecordByToken ──────────────────────────────────────────────────────
  // Public — used by the countersign page to show record details before signing.
  // Strips the token itself from the response.
  async function getRecordByToken(token: string) {
    const record = await db.employmentRecord.findUnique({
      where: { countersignToken: token },
      select: {
        id: true,
        jobTitle: true,
        department: true,
        startDate: true,
        endDate: true,
        employmentType: true,
        status: true,
        candidateSignedAt: true,
        countersignTokenExpiresAt: true,
        candidate: {
          select: {
            did: true,
            name: true,
            imageUrl: true,
          },
        },
        employer: { select: { name: true, domain: true } },
      },
    })

    if (!record) throw new Error('TOKEN_NOT_FOUND')
    if (record.countersignTokenExpiresAt && record.countersignTokenExpiresAt < new Date()) {
      throw new Error('TOKEN_EXPIRED')
    }
    if (record.status !== 'PENDING_EMPLOYER') throw new Error('TOKEN_ALREADY_USED')

    return record
  }

  // ── countersign ───────────────────────────────────────────────────────────
  // Employer accepts via the token link. Hashes the canonical document, moves
  // state to SIGNED, nulls out the token, and enqueues the Polygon anchor job.
  async function countersign(token: string) {
    const record = await db.employmentRecord.findUnique({
      where: { countersignToken: token },
    })

    if (!record) throw new Error('TOKEN_NOT_FOUND')
    if (record.countersignTokenExpiresAt && record.countersignTokenExpiresAt < new Date()) {
      throw new Error('TOKEN_EXPIRED')
    }
    if (record.status !== 'PENDING_EMPLOYER') throw new Error('TOKEN_ALREADY_USED')

    const canonicalDoc = buildCanonicalDocument(record)
    const documentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(canonicalDoc))
      .digest('hex')

    const updated = await db.employmentRecord.update({
      where: { id: record.id },
      data: {
        employerSignedAt: new Date(),
        documentHash,
        status: 'SIGNED',
        // Null out after first use — one-time token cannot be replayed
        countersignToken: null,
        countersignTokenExpiresAt: null,
      },
    })

    // Enqueue async Polygon anchor — 3 retries with exponential backoff
    await anchorQueue.add(
      'anchor-employment',
      { recordId: record.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } }
    )

    return updated
  }

  // ── rejectRecord ──────────────────────────────────────────────────────────
  async function rejectRecord(token: string) {
    const record = await db.employmentRecord.findUnique({ where: { countersignToken: token } })

    if (!record) throw new Error('TOKEN_NOT_FOUND')
    if (record.status !== 'PENDING_EMPLOYER') throw new Error('TOKEN_ALREADY_USED')

    return db.employmentRecord.update({
      where: { id: record.id },
      data: {
        status: 'REJECTED',
        countersignToken: null,
        countersignTokenExpiresAt: null,
      },
    })
  }

  // ── cancelRecord ──────────────────────────────────────────────────────────
  // Only the candidate can cancel, only while still PENDING_EMPLOYER.
  async function cancelRecord(recordId: string, candidateId: string) {
    const record = await db.employmentRecord.findUnique({ where: { id: recordId } })

    if (!record) throw new Error('RECORD_NOT_FOUND')
    if (record.candidateId !== candidateId) throw new Error('FORBIDDEN')
    if (record.status !== 'PENDING_EMPLOYER') throw new Error('CANNOT_CANCEL')

    return db.employmentRecord.update({
      where: { id: recordId },
      data: {
        status: 'CANCELLED',
        countersignToken: null,
        countersignTokenExpiresAt: null,
      },
    })
  }

  // ── getCandidateRecords ───────────────────────────────────────────────────
  async function getCandidateRecords(candidateId: string) {
    return db.employmentRecord.findMany({
      where: { candidateId },
      include: { employer: { select: { name: true, domain: true } } },
      orderBy: { startDate: 'desc' },
    })
  }

  // ── getPendingForEmployer ─────────────────────────────────────────────────
  // Employer dashboard — records where the employer has not yet responded.
  async function getPendingForEmployer(employerId: string) {
    return db.employmentRecord.findMany({
      where: { employerId, status: 'PENDING_EMPLOYER' },
      include: {
        candidate: {
          select: {
            did: true,
            name: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ── getRecordById ─────────────────────────────────────────────────────────
  // Only the candidate or the employer admin can view a specific record.
  async function getRecordById(recordId: string, requestingUserId: string) {
    const record = await db.employmentRecord.findUnique({
      where: { id: recordId },
      include: {
        employer: { select: { name: true, domain: true, adminUserId: true } },
        candidate: { select: { id: true, name: true } },
      },
    })

    if (!record) throw new Error('RECORD_NOT_FOUND')

    const isCandidate = record.candidateId === requestingUserId
    const isEmployerAdmin = record.employer.adminUserId === requestingUserId
    if (!isCandidate && !isEmployerAdmin) throw new Error('FORBIDDEN')

    return record
  }

  return {
    createRecord,
    getRecordByToken,
    countersign,
    rejectRecord,
    cancelRecord,
    getCandidateRecords,
    getPendingForEmployer,
    getRecordById,
  }
}

export type EmploymentService = ReturnType<typeof createEmploymentService>

// ── buildCanonicalDocument ────────────────────────────────────────────────
// Deterministic JSON representation of an employment record.
// Both parties agree on this shape by signing (or countersigning) the hash.
function buildCanonicalDocument(record: {
  id: string
  candidateId: string
  employerId: string
  jobTitle: string
  department: string | null
  startDate: Date
  endDate: Date | null
  employmentType: string
}) {
  return {
    '@context': 'https://attesta.io/schemas/employment/v1',
    type: 'EmploymentAttestation',
    id: record.id,
    candidateId: record.candidateId,
    employerId: record.employerId,
    jobTitle: record.jobTitle,
    department: record.department ?? null,
    startDate: record.startDate.toISOString().split('T')[0],
    endDate: record.endDate ? record.endDate.toISOString().split('T')[0] : null,
    employmentType: record.employmentType,
  }
}
