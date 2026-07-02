'use client'

import { useState } from 'react'
import type { EmploymentRecord } from '@attesta/shared'
import {
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_STATUS_COLORS,
} from '@attesta/shared'

interface Props {
  records: EmploymentRecord[]
}

export function EmploymentList({ records }: Props) {
  const [items, setItems] = useState(records)
  const [cancelling, setCancelling] = useState<string | null>(null)

  async function cancel(id: string) {
    setCancelling(id)
    try {
      const res = await fetch(`/api/employment/${id}/cancel`, { method: 'DELETE' })
      if (res.ok) {
        setItems(prev => prev.map(r => r.id === id ? { ...r, status: 'CANCELLED' as const } : r))
      }
    } finally {
      setCancelling(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
        <p className="text-gray-400 font-medium">No employment records yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Add your first record to start building verified work history.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(record => {
        const start = new Date(record.startDate).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short',
        })
        const end = record.endDate
          ? new Date(record.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
          : 'Present'

        return (
          <div key={record.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 text-sm">{record.jobTitle}</h3>
                  {record.department && (
                    <span className="text-xs text-gray-400">· {record.department}</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{record.employer.name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {start} – {end} · {EMPLOYMENT_TYPE_LABELS[record.employmentType]}
                </p>
                {record.chainTxHash && (
                  <a
                    href={`https://polygonscan.com/tx/${record.chainTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-500 hover:underline mt-1.5 inline-block"
                  >
                    View on Polygon ↗
                  </a>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap
                    ${EMPLOYMENT_STATUS_COLORS[record.status]}`}
                >
                  {EMPLOYMENT_STATUS_LABELS[record.status]}
                </span>
                {record.status === 'PENDING_EMPLOYER' && (
                  <button
                    onClick={() => cancel(record.id)}
                    disabled={cancelling === record.id}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                  >
                    {cancelling === record.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
