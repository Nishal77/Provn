'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SKILL_SLUGS, type SkillArtifactType } from '@attesta/shared'

const ARTIFACT_TYPE_LABELS: Record<SkillArtifactType, string> = {
  GITHUB_REPO: 'GitHub Repository',
  GIST: 'GitHub Gist',
  URL: 'Public URL',
  TEXT: 'Text / Paste',
}

export default function AddSkillPage() {
  const router = useRouter()
  const [skillSlug, setSkillSlug] = useState('')
  const [artifactType, setArtifactType] = useState<SkillArtifactType>('GITHUB_REPO')
  const [artifactUrl, setArtifactUrl] = useState('')
  const [artifactText, setArtifactText] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!skillSlug) { setError('Select a skill'); return }
    if (artifactType !== 'TEXT' && !artifactUrl.trim()) { setError('Artifact URL required'); return }
    if (artifactType === 'TEXT' && !artifactText.trim()) { setError('Paste your code or text'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillSlug,
          artifactType,
          artifactUrl: artifactType !== 'TEXT' ? artifactUrl : undefined,
          artifactText: artifactType === 'TEXT' ? artifactText : undefined,
          description: description.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        const msgMap: Record<string, string> = {
          ARTIFACT_REQUIRED: 'Provide an artifact URL or paste your code.',
          SKILL_ALREADY_PENDING: 'You already have an active evaluation for this skill.',
        }
        setError(msgMap[json.error?.code] ?? json.error?.code ?? 'Something went wrong')
        return
      }
      router.push('/skills')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add skill</h1>
        <p className="text-gray-500 text-sm mt-1">
          Submit an artifact. AI evaluates it — score takes up to 30 minutes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Skill picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Skill</label>
          <select
            value={skillSlug}
            onChange={e => setSkillSlug(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2
                       focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            <option value="">Select skill…</option>
            {SKILL_SLUGS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Artifact type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Artifact type</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(ARTIFACT_TYPE_LABELS) as [SkillArtifactType, string][]).map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => setArtifactType(type)}
                className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors text-left
                  ${artifactType === type
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Artifact input */}
        {artifactType !== 'TEXT' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {artifactType === 'GITHUB_REPO' ? 'Repository URL' :
               artifactType === 'GIST' ? 'Gist URL' : 'URL'}
            </label>
            <input
              type="url"
              value={artifactUrl}
              onChange={e => setArtifactUrl(e.target.value)}
              placeholder={
                artifactType === 'GITHUB_REPO' ? 'https://github.com/user/repo' :
                artifactType === 'GIST' ? 'https://gist.github.com/user/abc123' :
                'https://...'
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2
                         focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Code or text</label>
            <textarea
              value={artifactText}
              onChange={e => setArtifactText(e.target.value)}
              rows={10}
              placeholder="Paste your code, project description, or writing sample…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono
                         focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
            />
          </div>
        )}

        {/* Optional description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="What does this artifact demonstrate? Context helps the AI score more accurately."
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2
                       focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 px-4 bg-indigo-600 text-white text-sm font-semibold rounded-lg
                       hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit for evaluation'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/skills')}
            className="py-2.5 px-4 border border-gray-200 text-gray-600 text-sm font-semibold
                       rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
