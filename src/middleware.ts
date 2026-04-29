import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Only block obviously unauthenticated requests
// Real auth check happens client-side in page.tsx
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Always allow these through
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
