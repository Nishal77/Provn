'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME',   label: 'Full-time' },
  { value: 'PART_TIME',   label: 'Part-time' },
  { value: 'CONTRACT',    label: 'Contract' },
  { value: 'INTERNSHIP',  label: 'Internship' },
  { value: 'FREELANCE',   label: 'Freelance' },
] as const

const ERROR_MESSAGES: Record<string, string> = {
  EMPLOYER_NOT_FOUND:  'Employer not found. Check the Employer ID.',
  EMPLOYER_NOT_ACTIVE: 'Employer account is not yet active (domain not verified).',
  DUPLICATE_RECORD:    'An identical record already exists for this employer and role.',
  INVALID_INPUT:       'Please check all fields and try again.',
}

export default function AddEmploymentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentJob, setCurrentJob] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const payload = {
      employerId:     (fd.get('employerId') as string).trim(),
      jobTitle:       (fd.get('jobTitle') as string).trim(),
      department:     (fd.get('department') as string).trim() || undefined,
      startDate:      fd.get('startDate') as string,
      endDate:        currentJob ? undefined : (fd.get('endDate') as string) || undefined,
      employmentType: fd.get('employmentType') as string,
    }

    try {
      const res = await fetch('/api/employment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok) {
        const code = json.error?.code as string
        setError(ERROR_MESSAGES[code] ?? `Error: ${code}`)
        return
      }

      router.push('/employment')
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add Employment Record</h1>
        <p className="text-gray-500 text-sm mt-1">
          We'll email your employer a one-click verification link. No ATTESTA account required on their end.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="employerId" className="block text-sm font-medium text-gray-700 mb-1">
            Employer ID
          </label>
          <input
            id="employerId"
            name="employerId"
            required
            placeholder="e.g. cm8abc123..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Find the Employer ID on the company's ATTESTA profile or ask HR.
          </p>
        </div>

        <div>
          <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1">
            Job Title
          </label>
          <input
            id="jobTitle"
            name="jobTitle"
            required
            maxLength={120}
            placeholder="e.g. Senior Software Engineer"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
            Department <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="department"
            name="department"
            maxLength={80}
            placeholder="e.g. Engineering"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="employmentType" className="block text-sm font-medium text-gray-700 mb-1">
            Employment Type
          </label>
          <select
            id="employmentType"
            name="employmentType"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {EMPLOYMENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              disabled={currentJob}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                         disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={currentJob}
            onChange={e => setCurrentJob(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">I currently work here</span>
        </label>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg
                     hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Sending verification request…' : 'Submit for Employer Verification'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          A verification email will be sent to your employer's billing contact.
          They can confirm or reject via a one-click link — no login required.
        </p>
      </form>
    </div>
  )
}
