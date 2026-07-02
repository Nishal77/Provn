/**
 * FaceTec 3D Liveness verification service (ISO 30107-3 Level 2).
 *
 * FaceTec Browser SDK runs client-side and captures a 3D face scan.
 * This service handles the server-side half:
 *   1. Minting short-lived session tokens for the browser SDK.
 *   2. Validating liveness results from the SDK against FaceTec's server.
 *
 * Two API modes (same interface, different FACETEC_SERVER_URL):
 *   Dev:  FaceTec Managed Testing server (free, rate-limited)
 *   Prod: Self-hosted FaceTec App Server or enterprise API
 *
 * FaceTec integration guide: https://dev.facetec.com/server-side-integration
 */

interface FaceTecConfig {
  serverUrl: string
  deviceKeyIdentifier: string
  faceScanEncryptionKey: string
}

export interface FaceTecSessionParams {
  sessionToken: string
  deviceKeyIdentifier: string
  faceScanEncryptionKey: string
}

export interface FaceTecLivenessResult {
  success: boolean
  sessionId: string
  checks: {
    replayCheckSucceeded: boolean
    sessionTokenCheckSucceeded: boolean
    auditTrailCheckSucceeded: boolean
    faceScanLivenessCheckSucceeded: boolean
  }
}

export interface FaceTecValidateInput {
  sessionId: string
  faceScan: string
  auditTrailImage: string
  lowQualityAuditTrailImage: string
}

// FaceTec server-side API response shape
interface FaceTecServerResponse {
  wasProcessed: boolean
  sessionId: string
  faceScanSecurityChecks: {
    replayCheckSucceeded: boolean
    sessionTokenCheckSucceeded: boolean
    auditTrailCheckSucceeded: boolean
    faceScanLivenessCheckSucceeded: boolean
  }
}

export function createFaceTecService(config: FaceTecConfig) {
  const baseHeaders = {
    'Content-Type': 'application/json',
    'X-Device-Key': config.deviceKeyIdentifier,
    'User-Agent': 'ATTESTA-FaceTec-Server/1.0',
  }

  /**
   * Mint a short-lived FaceTec session token.
   * The browser SDK requires this token before starting a liveness check.
   * Tokens are single-use and expire in ~60 seconds.
   */
  async function getSessionToken(): Promise<FaceTecSessionParams> {
    const res = await fetch(`${config.serverUrl}/session-token`, {
      method: 'GET',
      headers: baseHeaders,
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`FaceTec session-token error ${res.status}: ${body}`)
    }

    const data = (await res.json()) as { sessionToken: string }

    return {
      sessionToken: data.sessionToken,
      deviceKeyIdentifier: config.deviceKeyIdentifier,
      faceScanEncryptionKey: config.faceScanEncryptionKey,
    }
  }

  /**
   * Validate a 3D liveness result from the browser SDK.
   * The SDK sends faceScan + auditTrail data to our backend, which forwards
   * it to FaceTec's server for cryptographic verification.
   *
   * All four security checks must pass for a PASSED result:
   *   replayCheck            — ensures the faceScan is not replayed from storage
   *   sessionTokenCheck      — ensures the session token was minted by us
   *   auditTrailCheck        — ensures the audit images are unmodified
   *   faceScanLivenessCheck  — ISO 30107-3 passive liveness detection
   */
  async function validateLiveness(input: FaceTecValidateInput): Promise<FaceTecLivenessResult> {
    const res = await fetch(`${config.serverUrl}/liveness-3d`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({
        sessionId: input.sessionId,
        faceScan: input.faceScan,
        auditTrailImage: input.auditTrailImage,
        lowQualityAuditTrailImage: input.lowQualityAuditTrailImage,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`FaceTec liveness-3d error ${res.status}: ${body}`)
    }

    const data = (await res.json()) as FaceTecServerResponse

    const checks = {
      replayCheckSucceeded: data.faceScanSecurityChecks?.replayCheckSucceeded ?? false,
      sessionTokenCheckSucceeded: data.faceScanSecurityChecks?.sessionTokenCheckSucceeded ?? false,
      auditTrailCheckSucceeded: data.faceScanSecurityChecks?.auditTrailCheckSucceeded ?? false,
      faceScanLivenessCheckSucceeded: data.faceScanSecurityChecks?.faceScanLivenessCheckSucceeded ?? false,
    }

    const success =
      data.wasProcessed &&
      checks.replayCheckSucceeded &&
      checks.sessionTokenCheckSucceeded &&
      checks.auditTrailCheckSucceeded &&
      checks.faceScanLivenessCheckSucceeded

    return {
      success,
      sessionId: data.sessionId,
      checks,
    }
  }

  return { getSessionToken, validateLiveness }
}

export type FaceTecService = ReturnType<typeof createFaceTecService>
