import { auth } from './auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/', '/login', '/signup', '/api/auth', '/proof', '/icon', '/employer/register',
  '/privacy', '/terms', '/gdpr', '/security', '/contact',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth

  if (!isAuthenticated && !isPublicPath(pathname)) {
    // Preserve the original destination so we can redirect back after login
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthenticated && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  // Run on all paths except static assets and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
