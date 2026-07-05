import { SignJWT } from 'jose'

export async function mintServiceToken(): Promise<string> {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return ''
  const key = new TextEncoder().encode(secret)
  return new SignJWT({ role: 'service' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(key)
}
