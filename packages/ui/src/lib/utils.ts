import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merges Tailwind classes intelligently — handles conflicts (e.g. p-4 + p-2 → p-2)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
