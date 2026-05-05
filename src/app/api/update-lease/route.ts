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
      console.error('[update-lease] Missing env vars', { url: !!url, key: !!key })
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }
    const { lease_id, ...updates } = await req.json()
    console.log('[update-lease] Request:', { lease_id, updates })
    const { error } = await supabase.from('leases')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('lease_id', lease_id)
    if (error) { console.error('[update-lease] Supabase error:', error); throw error }
    console.log('[update-lease] Success')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[update-lease] Caught error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
