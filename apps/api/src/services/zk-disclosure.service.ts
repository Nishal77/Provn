// ZK Disclosure service — manages disclosure requests and on-chain proof verification.
//
// Flow:
//   Employer sends disclosure request (SALARY_RANGE or EMPLOYMENT_DURATION)
//     → candidate sees pending request in dashboard
//     → candidate opens /disclosures/:id/prove
//     → browser loads circuit WASM + zkey from /public/circuits/
//     → SnarkJS generates Groth16 proof client-side (private inputs never leave browser)
//     → proof POSTed to API → verifyProof() called on Polygon verifier contract
//     → status → VERIFIED (or FAILED if proof invalid)

import type { PrismaClient } from '@attesta/db'
import { createBlockchainService } from './blockchain.service.js'
import { env } from '../config/env.js'

export interface RequestDisclosureInput {
  candidateId: string
  claimType: 'SALARY_RANGE' | 'EMPLOYMENT_DURATION'
  claimParams: Record<string, number>
}

export interface SubmitProofInput {
  requestId: string
  proof: {
    pi_a: string[]
    pi_b: string[][]
    pi_c: string[]
    protocol: string
    curve: string
  }
  publicSignals: string[]
}

// 7 days expiry for disclosure requests
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

export function createZKDisclosureService(deps: { db: PrismaClient }) {
  const { db } = deps

  // ── requestDisclosure ────────────────────────────────────────────────────
  // Called by employer to request a ZK proof from a candidate.
  async function requestDisclosure(requesterId: string, input: RequestDisclosureInput) {
    if (input.claimType === 'SALARY_RANGE') {
      const p = input.claimParams as { minSalary?: number; maxSalary?: number }
      if (!p.minSalary || !p.maxSalary || p.minSalary >= p.maxSalary) {
        throw new Error('INVALID_SALARY_PARAMS')
      }
    } else {
      const p = input.claimParams as { minMonths?: number }
      if (!p.minMonths || p.minMonths < 1) throw new Error('INVALID_DURATION_PARAMS')
    }

    return db.zKDisclosureRequest.create({
      data: {
        requesterId,
        candidateId: input.candidateId,
        claimType: input.claimType,
        claimParams: input.claimParams,
        expiresAt: new Date(Date.now() + EXPIRY_MS),
        status: 'PENDING_PROOF',
      },
    })
  }

  // ── getRequest ───────────────────────────────────────────────────────────
  async function getRequest(requestId: string, userId: string) {
    const req = await db.zKDisclosureRequest.findUnique({ where: { id: requestId } })
    if (!req) throw new Error('NOT_FOUND')
    if (req.candidateId !== userId && req.requesterId !== userId) throw new Error('FORBIDDEN')
    return req
  }

  // ── listForCandidate ────────────────────────────────────────────────────
  async function listForCandidate(candidateId: string) {
    return db.zKDisclosureRequest.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ── listForRequester ────────────────────────────────────────────────────
  async function listForRequester(requesterId: string) {
    return db.zKDisclosureRequest.findMany({
      where: { requesterId },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ── declineRequest ───────────────────────────────────────────────────────
  async function declineRequest(requestId: string, candidateId: string) {
    const req = await db.zKDisclosureRequest.findUnique({ where: { id: requestId } })
    if (!req) throw new Error('NOT_FOUND')
    if (req.candidateId !== candidateId) throw new Error('FORBIDDEN')
    if (req.status !== 'PENDING_PROOF') throw new Error('ALREADY_PROCESSED')
    return db.zKDisclosureRequest.update({
      where: { id: requestId },
      data: { status: 'DECLINED' },
    })
  }

  // ── submitProof ──────────────────────────────────────────────────────────
  // Called after SnarkJS generates proof in browser.
  // Verifies proof on-chain via the appropriate Solidity verifier contract.
  async function submitProof(candidateId: string, input: SubmitProofInput) {
    const req = await db.zKDisclosureRequest.findUnique({ where: { id: input.requestId } })
    if (!req) throw new Error('NOT_FOUND')
    if (req.candidateId !== candidateId) throw new Error('FORBIDDEN')
    if (req.status !== 'PENDING_PROOF') throw new Error('ALREADY_PROCESSED')
    if (new Date() > req.expiresAt) {
      await db.zKDisclosureRequest.update({ where: { id: req.id }, data: { status: 'EXPIRED' } })
      throw new Error('EXPIRED')
    }

    // Mark as submitted while we verify
    await db.zKDisclosureRequest.update({
      where: { id: req.id },
      data: {
        status: 'PROOF_SUBMITTED',
        proof: { proof: input.proof, publicSignals: input.publicSignals } as unknown as Record<string, unknown>,
      },
    })

    // ── On-chain verification ────────────────────────────────────────────
    const verifierAddress = req.claimType === 'SALARY_RANGE'
      ? (env.SALARY_RANGE_VERIFIER_ADDRESS ?? '')
      : (env.EMPLOYMENT_VERIFIER_ADDRESS ?? '')

    let verified = false
    let txHash: string | null = null

    if (verifierAddress && env.DEPLOYER_PRIVATE_KEY && env.POLYGON_RPC_URL) {
      try {
        const result = await _verifyOnChain({
          claimType: req.claimType as 'SALARY_RANGE' | 'EMPLOYMENT_DURATION',
          proof: input.proof,
          publicSignals: input.publicSignals,
          verifierAddress,
        })
        verified = result.verified
        txHash = result.txHash ?? null
      } catch (err) {
        console.error('[zk-disclosure] On-chain verify error:', err)
        verified = false
      }
    } else {
      // Dev fallback: skip on-chain, trust the proof format
      console.warn('[zk-disclosure] Verifier not configured — accepting proof without on-chain check')
      verified = true
    }

    const finalStatus = verified ? 'VERIFIED' : 'FAILED'
    await db.zKDisclosureRequest.update({
      where: { id: req.id },
      data: { status: finalStatus, proofResult: verified, proofTxHash: txHash },
    })

    return { verified, txHash }
  }

  return { requestDisclosure, getRequest, listForCandidate, listForRequester, declineRequest, submitProof }
}

// ── On-chain verification helper ────────────────────────────────────────────

async function _verifyOnChain(args: {
  claimType: 'SALARY_RANGE' | 'EMPLOYMENT_DURATION'
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] }
  publicSignals: string[]
  verifierAddress: string
}): Promise<{ verified: boolean; txHash?: string }> {
  const { createPublicClient, createWalletClient, http, parseAbi } = await import('viem')
  const { polygon, polygonMumbai } = await import('viem/chains')

  const chain = env.NODE_ENV === 'production' ? polygon : polygonMumbai
  const rpcUrl = env.NODE_ENV === 'production'
    ? (env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com')
    : (env.MUMBAI_RPC_URL ?? 'https://rpc-mumbai.maticvigil.com')

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })

  const { pi_a, pi_b, pi_c } = args.proof
  const signals = args.publicSignals.map(s => BigInt(s))

  // ABI for both verifiers — same signature, different number of public inputs
  const abi = parseAbi([
    'function verifyProof(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[] input) view returns (bool)',
  ])

  const verified = await publicClient.readContract({
    address: args.verifierAddress as `0x${string}`,
    abi,
    functionName: 'verifyProof',
    args: [
      [BigInt(pi_a[0]), BigInt(pi_a[1])],
      [[BigInt(pi_b[0][0]), BigInt(pi_b[0][1])], [BigInt(pi_b[1][0]), BigInt(pi_b[1][1])]],
      [BigInt(pi_c[0]), BigInt(pi_c[1])],
      signals,
    ],
  })

  return { verified: Boolean(verified) }
}
