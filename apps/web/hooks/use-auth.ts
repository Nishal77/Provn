'use client'

import { useSession } from 'next-auth/react'

/**
 * Convenience hook for accessing the current user session.
 * Returns the session data and loading state.
 *
 * Usage:
 *   const { user, isLoading, isAuthenticated } = useAuth()
 */
export function useAuth() {
  const { data: session, status } = useSession()

  return {
    user: session?.user ?? null,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
  }
}
