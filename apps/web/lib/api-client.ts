/**
 * Typed API client for the Fastify backend.
 * Uses the access token from session for authenticated requests.
 * Automatically refreshes the token when it expires (via /auth/refresh).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

type FetchOptions = RequestInit & { accessToken?: string }

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { accessToken, ...init } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include', // Send refresh token cookie
  })

  const data = await res.json() as T
  return data
}

export const apiClient = {
  profile: {
    getMe: (accessToken: string) =>
      apiFetch<{ success: true; data: { profile: unknown; user: unknown } }>(
        '/profile/me',
        { accessToken }
      ),

    update: (accessToken: string, body: Record<string, unknown>) =>
      apiFetch<{ success: boolean; data?: unknown; error?: { code: string; message: string } }>(
        '/profile/me',
        { method: 'PUT', body: JSON.stringify(body), accessToken }
      ),

    getCompleteness: (accessToken: string) =>
      apiFetch<{ success: true; data: { score: number; items: Array<{ label: string; done: boolean; points: number }> } }>(
        '/profile/me/completeness',
        { accessToken }
      ),

    getPublic: (did: string) =>
      apiFetch<{ success: boolean; data?: unknown; error?: { code: string } }>(
        `/profile/proof/${encodeURIComponent(did)}`
      ),
  },
}
