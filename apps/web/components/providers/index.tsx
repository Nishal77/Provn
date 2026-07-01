'use client'

import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import dynamic from 'next/dynamic'

// PrivyProvider is loaded client-side only.
// WHY: Privy validates the app ID at initialization time.
// During Next.js SSR / static export, NEXT_PUBLIC_PRIVY_APP_ID is often
// empty (CI, local without .env), which throws and breaks the build.
// Dynamic import with ssr:false defers initialization to the browser.
const PrivyProviderDynamic = dynamic(
  () =>
    import('./privy-provider').then((mod) => ({
      default: mod.PrivyProviderClient,
    })),
  { ssr: false }
)

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // Data is "fresh" for 1 minute before refetch
            retry: 1,
          },
        },
      })
  )

  return (
    <SessionProvider>
      <PrivyProviderDynamic>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </PrivyProviderDynamic>
    </SessionProvider>
  )
}
