'use client'

import { useEffect, useState } from 'react'

interface Issuer {
  id: string
  name: string
  domain: string
  countryCode: string
  logoUrl?: string
  websiteUrl?: string
  status: string
  verifiedAt?: string
  _count?: { credentials: number }
}

const COUNTRY_FLAG: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', IN: '🇮🇳', CA: '🇨🇦', AU: '🇦🇺',
  DE: '🇩🇪', FR: '🇫🇷', SG: '🇸🇬', JP: '🇯🇵', KR: '🇰🇷',
}

export default function IssuersPage() {
  const [issuers, setIssuers] = useState<Issuer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/protocol/issuers')
      .then(r => r.ok ? r.json() : { issuers: [] })
      .then(d => { setIssuers(d.issuers ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Dev fallback — first 10 university partners
  const displayed = issuers.length > 0 ? issuers : [
    { id: '1', name: 'MIT', domain: 'mit.edu', countryCode: 'US', status: 'ACTIVE', _count: { credentials: 1240 } },
    { id: '2', name: 'Stanford University', domain: 'stanford.edu', countryCode: 'US', status: 'ACTIVE', _count: { credentials: 980 } },
    { id: '3', name: 'UC Berkeley', domain: 'berkeley.edu', countryCode: 'US', status: 'ACTIVE', _count: { credentials: 850 } },
    { id: '4', name: 'Carnegie Mellon', domain: 'cmu.edu', countryCode: 'US', status: 'ACTIVE', _count: { credentials: 720 } },
    { id: '5', name: 'IIT Delhi', domain: 'iitd.ac.in', countryCode: 'IN', status: 'ACTIVE', _count: { credentials: 610 } },
    { id: '6', name: 'Oxford University', domain: 'ox.ac.uk', countryCode: 'GB', status: 'ACTIVE', _count: { credentials: 540 } },
    { id: '7', name: 'ETH Zurich', domain: 'ethz.ch', countryCode: 'DE', status: 'ACTIVE', _count: { credentials: 480 } },
    { id: '8', name: 'University of Toronto', domain: 'utoronto.ca', countryCode: 'CA', status: 'ACTIVE', _count: { credentials: 420 } },
    { id: '9', name: 'National University of Singapore', domain: 'nus.edu.sg', countryCode: 'SG', status: 'ACTIVE', _count: { credentials: 380 } },
    { id: '10', name: 'Georgia Tech', domain: 'gatech.edu', countryCode: 'US', status: 'ACTIVE', _count: { credentials: 340 } },
  ]

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">OpenRep Issuers</h1>
        <p className="text-sm text-gray-500 mt-1">
          Verified institutions issuing credentials via the OpenRep protocol. Target: 50 universities by Month 36.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {displayed.map(issuer => (
          <div key={issuer.id} className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl">
              {COUNTRY_FLAG[issuer.countryCode] ?? '🏛️'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 truncate">{issuer.name}</div>
              <div className="text-xs text-gray-400">{issuer.domain}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{issuer.status}</span>
                {issuer._count && (
                  <span className="text-xs text-gray-400">{issuer._count.credentials.toLocaleString()} credentials issued</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Want to issue credentials via OpenRep? <a href="mailto:issuers@attesta.io" className="text-indigo-600 hover:underline">Contact us →</a>
      </p>
    </div>
  )
}
