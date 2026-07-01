'use client'

import { PrivyProvider } from '@privy-io/react-auth'

interface Props {
  children: React.ReactNode
}

// Separated into its own file so dynamic import ssr:false works cleanly.
// This component is only rendered in the browser, never on the server.
export function PrivyProviderClient({ children }: Props) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  // When no app ID is configured (local dev without .env, CI), render
  // children directly. Privy wallet features won't work but auth still will.
  if (!appId) {
    return <>{children}</>
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Privy silently creates an embedded Polygon wallet for every new user.
        // Users see no "wallet" UI — it's invisible infrastructure.
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: {
          id: 137,
          name: 'Polygon',
          nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
          rpcUrls: { default: { http: ['https://polygon-rpc.com'] } },
        },
        appearance: {
          theme: 'light',
          accentColor: '#3B82F6',
        },
        loginMethods: ['wallet'],
      }}
    >
      {children}
    </PrivyProvider>
  )
}
