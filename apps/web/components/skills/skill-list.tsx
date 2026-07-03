'use client'

import { useState } from 'react'
import type { SkillAttestation } from '@attesta/shared'
import { SKILL_STATUS_LABELS, SKILL_STATUS_COLORS } from '@attesta/shared'

interface Props {
  initialSkills: SkillAttestation[]
}

function SkillLevelBar({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className={`h-2 w-2.5 rounded-sm transition-colors ${
              i < level ? 'bg-indigo-500' : 'bg-gray-100'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500 font-medium">{level}/10</span>
    </div>
  )
}

function SkillCard({ skill }: { skill: SkillAttestation }) {
  const statusLabel = SKILL_STATUS_LABELS[skill.status]
  const statusClass = SKILL_STATUS_COLORS[skill.status]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm capitalize">{skill.skillSlug.replace(/-/g, ' ')}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}>
              {statusLabel}
            </span>
          </div>

          {skill.skillLevel !== null && skill.skillLevel !== undefined && (
            <div className="mt-2">
              <SkillLevelBar level={skill.skillLevel} />
            </div>
          )}

          {skill.aiEvalScore !== null && skill.aiEvalScore !== undefined && (
            <p className="text-xs text-gray-500 mt-1">
              AI score: <span className="font-medium text-gray-700">{Number(skill.aiEvalScore).toFixed(0)}/100</span>
            </p>
          )}
        </div>

        {skill.status === 'ANCHORED' && skill.chainTxHash && (
          <a
            href={`https://polygonscan.com/tx/${skill.chainTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            View on Polygon ↗
          </a>
        )}
      </div>

      {(skill.status === 'PENDING' || skill.status === 'EVALUATING') && (
        <p className="text-xs text-gray-400 mt-3">
          AI evaluation in progress — up to 30 minutes. Refresh to check status.
        </p>
      )}

      {skill.status === 'FAILED' && (
        <p className="text-xs text-red-500 mt-3">
          Evaluation failed.
          {skill.plagiarismScore !== null && Number(skill.plagiarismScore) > 0.85
            ? ' High plagiarism score detected.'
            : ' Try resubmitting.'}
        </p>
      )}

      {skill.artifactUrl && (
        <a
          href={skill.artifactUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-gray-400 hover:text-gray-600 mt-2 truncate max-w-xs"
        >
          {skill.artifactUrl}
        </a>
      )}
    </div>
  )
}

export function SkillList({ initialSkills }: Props) {
  const [skills] = useState<SkillAttestation[]>(initialSkills)

  if (skills.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
        <p className="text-gray-400 font-medium">No skills yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Submit your first artifact to get an AI-verified skill badge.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {skills.map(skill => (
        <SkillCard key={skill.id} skill={skill} />
      ))}
    </div>
  )
}
