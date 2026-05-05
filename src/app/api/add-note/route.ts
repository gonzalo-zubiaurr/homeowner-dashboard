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
      console.error('[add-note] Missing env vars', { url: !!url, key: !!key })
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }
    const { lease_id, note, author } = await req.json()
    console.log('[add-note] Request:', { lease_id, author, noteLength: note?.length })
    const { error: noteError } = await supabase.from('lease_notes').insert({
      lease_id, note, author, created_at: new Date().toISOString()
    })
    if (noteError) { console.error('[add-note] Insert error:', noteError); throw noteError }
    const { error: leaseError } = await supabase.from('leases')
      .update({ last_note_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('lease_id', lease_id)
    if (leaseError) { console.error('[add-note] Lease update error:', leaseError); throw leaseError }
    console.log('[add-note] Success')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[add-note] Caught error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
