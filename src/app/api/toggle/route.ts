import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export async function POST(req: NextRequest) {
  try {
    const { home_id, item_key, completed } = await req.json()
    const { error } = await supabase.from('checklist_items').upsert(
      { home_id, item_key, completed, completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() },
      { onConflict: 'home_id,item_key' }
    )
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) { return NextResponse.json({ error: String(err) }, { status: 500 }) }
}
