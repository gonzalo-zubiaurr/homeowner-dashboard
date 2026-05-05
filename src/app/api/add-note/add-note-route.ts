import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { lease_id, note, author } = await req.json()
    const { error: noteError } = await supabase.from('lease_notes').insert({
      lease_id, note, author, created_at: new Date().toISOString()
    })
    if (noteError) throw noteError
    const { error: leaseError } = await supabase.from('leases')
      .update({ last_note_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('lease_id', lease_id)
    if (leaseError) throw leaseError
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 }) }
}
