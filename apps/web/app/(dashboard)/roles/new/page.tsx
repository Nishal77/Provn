'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROLE_DOMAIN_LABELS } from '@attesta/shared'
import type { RoleDomain } from '@attesta/shared'

export default function NewRolePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    domain: 'CODE' as RoleDomain,
    descriptionText: '',
    compensationMinUsd: '',
    compensationMaxUsd: '',
    remote: true,
    location: '',
    githubRepoUrl: '',
    figmaProjectUrl: '',
    blindMode: true,
  })

  function set(k: string, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        compensationMinUsd: form.compensationMinUsd ? parseInt(form.compensationMinUsd, 10) : undefined,
        compensationMaxUsd: form.compensationMaxUsd ? parseInt(form.compensationMaxUsd, 10) : undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed'); setLoading(false); return }
    router.push(`/roles/${data.role.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 mb-6">← Back</button>
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">New Role</h1>
      <p className="text-sm text-gray-500 mb-8">Connect your GitHub repo — AI extracts real requirements, not just keywords.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job title *</label>
          <input
            required
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Senior Software Engineer"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            <select
              value={form.domain}
              onChange={e => set('domain', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {(Object.keys(ROLE_DOMAIN_LABELS) as RoleDomain[]).map(d => (
                <option key={d} value={d}>{ROLE_DOMAIN_LABELS[d]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 pb-2 cursor-pointer">
              <input type="checkbox" checked={form.blindMode} onChange={e => set('blindMode', e.target.checked)} className="rounded" />
              Blind matching mode
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min comp (USD)</label>
            <input
              type="number"
              value={form.compensationMinUsd}
              onChange={e => set('compensationMinUsd', e.target.value)}
              placeholder="150000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max comp (USD)</label>
            <input
              type="number"
              value={form.compensationMaxUsd}
              onChange={e => set('compensationMaxUsd', e.target.value)}
              placeholder="200000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GitHub repo URL</label>
          <input
            type="url"
            value={form.githubRepoUrl}
            onChange={e => set('githubRepoUrl', e.target.value)}
            placeholder="https://github.com/yourorg/yourrepo"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <p className="text-xs text-gray-400 mt-1">AI analyzes your actual codebase to extract real requirements</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job description (optional)</label>
          <textarea
            value={form.descriptionText}
            onChange={e => set('descriptionText', e.target.value)}
            rows={4}
            placeholder="Describe the role… (AI will supplement with repo analysis)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.remote} onChange={e => set('remote', e.target.checked)} className="rounded" />
            Remote OK
          </label>
          {!form.remote && (
            <input
              value={form.location}
              onChange={e => set('location', e.target.value)}
              placeholder="San Francisco, CA"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Creating role…' : 'Create role + extract requirements'}
        </button>
      </form>
    </div>
  )
}
