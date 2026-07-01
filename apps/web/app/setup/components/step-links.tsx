'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input, Label } from '@attesta/ui'

const schema = z.object({
  githubUsername: z.string().max(39).optional().or(z.literal('')),
  linkedinUrl: z
    .string()
    .url('Enter a valid URL')
    .optional()
    .or(z.literal('')),
  websiteUrl: z
    .string()
    .url('Enter a valid URL')
    .optional()
    .or(z.literal('')),
})

export type StepLinksValues = z.infer<typeof schema>

interface StepLinksProps {
  defaultValues?: Partial<StepLinksValues>
  onNext: (values: StepLinksValues) => void
  onBack: () => void
  isLoading?: boolean
}

export function StepLinks({ defaultValues, onNext, onBack, isLoading }: StepLinksProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<StepLinksValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <div>
        <Label htmlFor="github">GitHub Username</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">github.com/</span>
          <Input
            id="github"
            placeholder="yourusername"
            error={errors.githubUsername?.message}
            {...register('githubUsername')}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Phase 6 will auto-analyse your repos for skill evidence.
        </p>
      </div>

      <div>
        <Label htmlFor="linkedin">LinkedIn URL</Label>
        <Input
          id="linkedin"
          placeholder="https://linkedin.com/in/yourname"
          error={errors.linkedinUrl?.message}
          {...register('linkedinUrl')}
        />
      </div>

      <div>
        <Label htmlFor="website">Personal Website</Label>
        <Input
          id="website"
          placeholder="https://yoursite.com"
          error={errors.websiteUrl?.message}
          {...register('websiteUrl')}
        />
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit" className="flex-1" loading={isLoading}>
          Finish Setup ✓
        </Button>
      </div>
    </form>
  )
}
