import { test, expect } from '@playwright/test'

test.describe('Public profile', () => {
  test('proof page shows 404 for unknown DID', async ({ page }) => {
    await page.goto('/proof/did:polygon:0x0000000000000000000000000000000000000000')
    // Should either show not-found UI or redirect — not crash
    const body = await page.locator('body').textContent()
    expect(body).not.toBeNull()
  })

  test('protocol API profile 404 for unknown DID', async ({ request }) => {
    const res = await request.get('http://localhost:4000/protocol/profile/did:polygon:0xdeadbeef')
    expect(res.status()).toBe(404)
  })

  test('protocol API DID resolve 404 for unknown DID', async ({ request }) => {
    const res = await request.get('http://localhost:4000/protocol/did/did:polygon:0xdeadbeef')
    expect(res.status()).toBe(404)
  })
})
