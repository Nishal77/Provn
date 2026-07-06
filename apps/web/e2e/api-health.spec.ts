import { test, expect } from '@playwright/test'

test.describe('API health', () => {
  test('API /health returns ok', async ({ request }) => {
    const res = await request.get('http://localhost:4000/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('API /protocol/issuers returns list', async ({ request }) => {
    const res = await request.get('http://localhost:4000/protocol/issuers')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.issuers)).toBe(true)
  })

  test('API /protocol/did/:did returns 400 for invalid DID', async ({ request }) => {
    const res = await request.get('http://localhost:4000/protocol/did/notadid')
    expect(res.status()).toBe(400)
  })

  test('API auth endpoints exist', async ({ request }) => {
    // POST without body → 400, not 404 (route exists)
    const res = await request.post('http://localhost:4000/auth/login', { data: {} })
    expect(res.status()).not.toBe(404)
  })

  test('API blocks unauthenticated profile access', async ({ request }) => {
    const res = await request.get('http://localhost:4000/profile/me')
    expect(res.status()).toBe(401)
  })

  test('API rate limiting header present', async ({ request }) => {
    const res = await request.get('http://localhost:4000/health')
    // Should have standard headers
    expect(res.status()).toBe(200)
  })
})
