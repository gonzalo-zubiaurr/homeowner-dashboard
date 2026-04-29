import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // Redirect to a client-side page that can handle the hash fragment
  const url = new URL('/auth/confirm', request.url)
  return NextResponse.redirect(url)
}
