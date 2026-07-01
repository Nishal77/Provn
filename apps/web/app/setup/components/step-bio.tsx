'use client'

import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Label } from '@attesta/ui'

const schema = z.object({
  bio: z.string().max(2000, 'Max 2000 characters').optional(),
})

export type StepBioValues = z.infer<typeof schema>

interface StepBioProps {
  defaultValues?: Partial<StepBioValues>
  onNext: (values: StepBioValues) => void
  onBack: () => void
}

export function StepBio({ defaultValues, onNext, onBack }: StepBioProps) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<StepBioValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const bioLength = watch('bio')?.length ?? 0

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="bio">About You</Label>
          <span className="text-xs text-muted-foreground">{bioLength}/2000</span>
        </div>
        <textarea
          id="bio"
          rows={6}
          placeholder="I'm a full-stack engineer with 5 years building fintech products. I love clean APIs and fast UIs..."
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register('bio')}
        />
        {errors.bio && <p className="text-xs text-destructive">{errors.bio.message}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          Shown on your public ProofWork profile. No PII — email is never shown.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit" className="flex-1" loading={isSubmitting}>
          Continue →
        </Button>
      </div>
    </form>
  )
}
