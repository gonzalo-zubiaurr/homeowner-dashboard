import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_DOMAINS = ['belonghome.com', 'belong.pe']
const PUBLIC_PATHS = ['/login', '/auth/confirm', '/auth/callback']

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Always allow public paths through - no auth check
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for Supabase session cookie
  const hasSession = request.cookies.getAll().some(c => 
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )

  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
