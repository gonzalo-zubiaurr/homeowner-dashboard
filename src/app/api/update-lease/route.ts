import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export async function POST(req: NextRequest) {
  try {
    const { lease_id, ...updates } = await req.json()
    const { error } = await supabase.from('leases').update({ ...updates, updated_at: new Date().toISOString() }).eq('lease_id', lease_id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) { return NextResponse.json({ error: String(err) }, { status: 500 }) }
}
