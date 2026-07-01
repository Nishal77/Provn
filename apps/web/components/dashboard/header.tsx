'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { Button } from '@attesta/ui'
import type { Session } from 'next-auth'

interface DashboardHeaderProps {
  user: Session['user']
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/dashboard" className="text-xl font-bold text-primary">
          ATTESTA
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Dashboard
          </Link>

          <div className="flex items-center gap-3">
            {user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? 'Avatar'}
                className="h-8 w-8 rounded-full object-cover"
              />
            )}
            <span className="text-sm font-medium">{user.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              Sign Out
            </Button>
          </div>
        </nav>
      </div>
    </header>
  )
}
