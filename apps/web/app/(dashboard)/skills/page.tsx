import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SignJWT } from 'jose'
import Link from 'next/link'
import { SkillList } from '@/components/skills/skill-list'
import type { SkillAttestation } from '@attesta/shared'

async function fetchSkills(userId: string, did: string | null, tier: string): Promise<SkillAttestation[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) return []

  const token = await new SignJWT({ sub: userId, did, tier })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret))

  const res = await fetch(`${apiUrl}/skills`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const json = await res.json()
  return json.data ?? []
}

export default async function SkillsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as { id: string; did?: string; kycTier?: string }
  const skills = await fetchSkills(user.id, user.did ?? null, user.kycTier ?? 'T6_SELF')

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skills</h1>
          <p className="text-gray-500 text-sm mt-1">
            Submit artifacts for AI evaluation. Verified skills appear on your ProofWork profile.
          </p>
        </div>
        <Link
          href="/skills/add"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg
                     hover:bg-indigo-700 transition-colors shrink-0"
        >
          Add skill
        </Link>
      </div>

      <SkillList initialSkills={skills} />
    </div>
  )
}
