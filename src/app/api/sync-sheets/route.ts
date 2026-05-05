import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      console.error('[sync-sheets] Missing env vars', { url: !!url, key: !!key })
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }
    console.log('[sync-sheets] Request received')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[sync-sheets] Caught error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
