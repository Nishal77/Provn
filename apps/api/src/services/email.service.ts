// Transactional email service via Resend.
// Gracefully degrades when RESEND_API_KEY is absent — logs a warning and skips
// sending. This keeps the dev loop fast when email is not needed.

import { env } from '../config/env.js'

const FROM = 'ATTESTA <noreply@attesta.io>'
const RESEND_API = 'https://api.resend.com/emails'

// Thin HTTP wrapper — avoids pulling the Resend SDK into bundle size.
async function sendEmail(payload: {
  from: string
  to: string
  subject: string
  html: string
}): Promise<void> {
  const key = env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — email skipped:', payload.subject)
    return
  }

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    // Log but don't throw — a failed email must not block the co-sign state machine
    console.error(`[email] Resend error ${res.status}:`, body)
  }
}

// ── sendCountersignRequest ──────────────────────────────────────────────────
// Sent to the employer billing contact when a candidate submits an employment record.
export async function sendCountersignRequest(params: {
  toEmail: string
  candidateName: string
  jobTitle: string
  employerName: string
  countersignUrl: string
  expiresAt: Date
}): Promise<void> {
  const expiry = params.expiresAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  await sendEmail({
    from: FROM,
    to: params.toEmail,
    subject: `Employment verification request from ${params.candidateName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        <h2 style="margin-bottom:4px">Employment Verification Request</h2>
        <p style="color:#444">
          <strong>${params.candidateName}</strong> has listed you as their employer at
          <strong>${params.employerName}</strong> for the role of
          <strong>${params.jobTitle}</strong>.
        </p>
        <p style="color:#444">
          ATTESTA uses cryptographic co-signatures to create tamper-proof employment records
          on the Polygon blockchain. Your co-signature confirms this person worked at your
          organisation — no ATTESTA account is required on your end.
        </p>
        <a href="${params.countersignUrl}"
           style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;
                  border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;
                  margin:20px 0">
          Review &amp; Sign (or Reject)
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">
          This link expires on ${expiry}.<br>
          If you did not expect this request, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}

// ── sendAnchorConfirmation ──────────────────────────────────────────────────
// Sent to the candidate after their employment record is confirmed on Polygon.
export async function sendAnchorConfirmation(params: {
  toEmail: string
  candidateName: string
  jobTitle: string
  employerName: string
  chainTxHash: string
  polygonscanUrl: string
}): Promise<void> {
  const shortHash = `${params.chainTxHash.slice(0, 10)}…${params.chainTxHash.slice(-6)}`

  await sendEmail({
    from: FROM,
    to: params.toEmail,
    subject: `Employment record anchored — ${params.jobTitle} at ${params.employerName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        <h2 style="color:#16a34a;margin-bottom:4px">✓ Employment Record On-Chain</h2>
        <p style="color:#444">
          Hi ${params.candidateName},<br><br>
          Your employment record (<strong>${params.jobTitle}</strong> at
          <strong>${params.employerName}</strong>) has been cryptographically anchored
          on the Polygon blockchain.
        </p>
        <p style="color:#444">
          <strong>Transaction:</strong>
          <a href="${params.polygonscanUrl}" style="color:#6366f1">${shortHash}</a>
        </p>
        <p style="color:#444">
          Your ATTESTA profile now carries a <strong>T2 Employer Verified</strong> badge
          (9/10 trust score).
        </p>
        <a href="${env.WEB_URL ?? 'https://attesta.io'}/dashboard"
           style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;
                  border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;
                  margin:20px 0">
          View Your Profile
        </a>
      </div>
    `,
  })
}

export async function sendPeerAttestationRequest(params: {
  toEmail: string
  requesterName: string
  skillSlug: string
  attestUrl: string
  expiresAt: Date
}): Promise<void> {
  const expiry = params.expiresAt.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  await sendEmail({
    from: FROM,
    to: params.toEmail,
    subject: `${params.requesterName} asks you to co-sign a skill on ATTESTA`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        <h2 style="margin-bottom:4px">Peer Skill Attestation Request</h2>
        <p style="color:#444">
          <strong>${params.requesterName}</strong> has listed you as someone who can vouch
          for their <strong>${params.skillSlug}</strong> skill on ATTESTA.
        </p>
        <p style="color:#444">
          Your co-signature adds a verified peer endorsement to their professional profile.
          No ATTESTA account required — the link below takes you directly to the review.
        </p>
        <a href="${params.attestUrl}"
           style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;
                  border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;
                  margin:20px 0">
          Review &amp; Co-Sign
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">
          This link expires on ${expiry}. If you don't know this person, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}
