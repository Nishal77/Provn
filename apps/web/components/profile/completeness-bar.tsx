import { cn } from '@attesta/ui'

interface CompletenessBarProps {
  score: number // 0-100
  showLabel?: boolean
  className?: string
}

export function CompletenessBar({ score, showLabel = true, className }: CompletenessBarProps) {
  const clamped = Math.min(100, Math.max(0, score))

  const color =
    clamped >= 80
      ? 'bg-emerald-500'
      : clamped >= 50
        ? 'bg-blue-500'
        : clamped >= 25
          ? 'bg-amber-500'
          : 'bg-slate-400'

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Profile completeness</span>
          <span className="font-medium">{clamped}%</span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-secondary">
        <div
          className={cn('h-2 rounded-full transition-all duration-500', color)}
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
