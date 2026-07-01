'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input, Label } from '@attesta/ui'

const schema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(100),
  headline: z.string().max(160, 'Max 160 characters').optional(),
  location: z.string().max(100).optional(),
})

export type StepBasicValues = z.infer<typeof schema>

interface StepBasicProps {
  defaultValues?: Partial<StepBasicValues>
  onNext: (values: StepBasicValues) => void
}

export function StepBasic({ defaultValues, onNext }: StepBasicProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<StepBasicValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-5">
      <div>
        <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
        <Input id="name" placeholder="Priya Sharma" error={errors.name?.message} {...register('name')} />
      </div>

      <div>
        <Label htmlFor="headline">Professional Headline</Label>
        <Input
          id="headline"
          placeholder="Senior Full-Stack Engineer · Open to work"
          error={errors.headline?.message}
          {...register('headline')}
        />
        <p className="mt-1 text-xs text-muted-foreground">Appears under your name on your public profile.</p>
      </div>

      <div>
        <Label htmlFor="location">Location</Label>
        <Input id="location" placeholder="San Francisco, CA" {...register('location')} />
      </div>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Continue →
      </Button>
    </form>
  )
}
