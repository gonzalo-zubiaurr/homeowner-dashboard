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
      console.error('[toggle] Missing env vars', { url: !!url, key: !!key })
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }
    const { home_id, item_key, completed } = await req.json()
    console.log('[toggle] Request:', { home_id, item_key, completed })
    const { error } = await supabase.from('checklist_items').upsert(
      { home_id, item_key, completed, completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() },
      { onConflict: 'home_id,item_key' }
    )
    if (error) { console.error('[toggle] Supabase error:', error); throw error }
    console.log('[toggle] Success')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[toggle] Caught error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
