import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_DOMAINS = ['belonghome.com', 'belong.pe']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Allow auth routes through
  if (request.nextUrl.pathname.startsWith('/auth/')) {
    return response
  }

  // If on login page, allow through
  if (request.nextUrl.pathname === '/login') {
    // If already logged in with valid domain, redirect to home
    if (user && ALLOWED_DOMAINS.some(d => user.email?.endsWith(`@${d}`))) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  // Not logged in → redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged in but wrong domain → redirect to login with error
  if (!ALLOWED_DOMAINS.some(d => user.email?.endsWith(`@${d}`))) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=domain', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
