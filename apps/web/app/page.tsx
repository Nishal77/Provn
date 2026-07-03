import Link from 'next/link'
import { auth } from '../auth'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="font-extrabold text-xl tracking-tight text-gray-900">ATTESTA</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-full
                        px-4 py-1.5 text-xs font-semibold text-indigo-700 mb-6">
          <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
          Trust infrastructure for professional work
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
          Replace resumes<br />with cryptographic proof
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          ATTESTA anchors your credentials on Polygon. Every employer co-sign, AI skill score,
          and ZK disclosure — permanently verifiable, fraud-proof, and yours.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="px-8 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700
                       transition-colors text-base shadow-sm shadow-indigo-200"
          >
            Build your ProofWork profile →
          </Link>
          <Link
            href="/employer/register"
            className="px-8 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl
                       hover:bg-gray-50 transition-colors text-base"
          >
            Hire with ATTESTA
          </Link>
        </div>
      </section>

      {/* Problem stats */}
      <section className="bg-gray-50 border-y border-gray-100 py-14">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-sm font-semibold text-gray-400 uppercase tracking-widest mb-10">
            The hiring system is broken
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-center">
            {[
              { stat: '$600B', label: 'Resume fraud annual cost' },
              { stat: '68.5 days', label: 'Average time to hire' },
              { stat: '88%', label: 'Qualified candidates ATS-rejected' },
              { stat: '27.4%', label: 'Job listings are ghost jobs' },
              { stat: '50%', label: 'Companies hit by interview deepfakes' },
              { stat: '7%', label: 'Applicants have referral advantage' },
            ].map(({ stat, label }) => (
              <div key={label}>
                <p className="text-3xl font-extrabold text-gray-900 mb-1">{stat}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Five-module stack */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-12">
          Five layers of trust
        </h2>
        <div className="space-y-4">
          {[
            { layer: 'Layer 5', name: 'RoleFit AI', desc: 'Precision job↔person matching — replace ATS', color: 'bg-violet-50 border-violet-200', badge: 'Phase 10' },
            { layer: 'Layer 4', name: 'TrustChain Talent', desc: 'Programmable referral network via smart contracts', color: 'bg-purple-50 border-purple-200', badge: 'Phase 11' },
            { layer: 'Layer 3', name: 'WorkProof Live', desc: 'Paid 2-8hr real-work trials — replace interviews', color: 'bg-blue-50 border-blue-200', badge: 'Phase 9' },
            { layer: 'Layer 2', name: 'ProofWork', desc: 'Verified credentials anchored on Polygon — replace resume', color: 'bg-indigo-50 border-indigo-200', badge: 'Live ✓' },
            { layer: 'Layer 1', name: 'OpenRep', desc: 'Open protocol for professional trust — like HTTP', color: 'bg-green-50 border-green-200', badge: 'Live ✓' },
          ].map(m => (
            <div key={m.name} className={`flex items-center gap-4 p-4 rounded-xl border ${m.color}`}>
              <div className="w-20 shrink-0 text-xs font-semibold text-gray-400">{m.layer}</div>
              <div className="flex-1">
                <span className="font-bold text-gray-900 text-sm">{m.name}</span>
                <span className="text-gray-500 text-sm ml-2">— {m.desc}</span>
              </div>
              <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full
                ${m.badge.includes('✓') ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {m.badge}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 py-16 text-center">
        <h2 className="text-3xl font-extrabold text-white mb-4">Your reputation shouldn't live in a PDF</h2>
        <p className="text-indigo-200 mb-8 text-lg">
          Join ATTESTA. Get your first verified credential in minutes.
        </p>
        <Link
          href="/signup"
          className="px-8 py-3.5 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors"
        >
          Create free ProofWork profile
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-bold text-gray-900">ATTESTA</span>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-600">Terms</Link>
            <a href="https://github.com/attesta-io" target="_blank" rel="noopener noreferrer"
               className="hover:text-gray-600">GitHub</a>
          </div>
          <p className="text-xs text-gray-300">© 2026 ATTESTA Inc.</p>
        </div>
      </footer>
    </main>
  )
}
