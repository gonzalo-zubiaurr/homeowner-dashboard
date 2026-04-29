import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

function parseDate(val: string): string | null {
  if (!val?.trim()) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text()
    const lines = text.split('\n').filter(l => l.trim())
    const headers = lines[0].split(',').map(h => h.trim())
    const get = (row: string[], key: string) => { const i = headers.indexOf(key); return i >= 0 ? (row[i] || '').trim() : '' }

    const rows: string[][] = []
    for (let i = 1; i < lines.length; i++) {
      const row: string[] = []; let cur = ''; let inQ = false
      for (const ch of lines[i]) {
        if (ch === '"') inQ = !inQ
        else if (ch === ',' && !inQ) { row.push(cur.trim()); cur = '' }
        else cur += ch
      }
      row.push(cur.trim())
      if (row.length > 3) rows.push(row)
    }

    const homes = [...new Set(rows.map(r => get(r, 'HomeId')).filter(Boolean))].map(id => {
      const r = rows.find(r => get(r, 'HomeId') === id)!
      return { home_id: id, home_link: get(r, 'HomeLink') }
    })
    if (homes.length) await supabase.from('homes').upsert(homes, { onConflict: 'home_id' })

    const { data: existing } = await supabase.from('leases').select('lease_id,manual_status,notes,escalated')
    const existMap: Record<string, any> = {}
    for (const l of (existing || [])) existMap[l.lease_id] = l

    const leaseRows = rows.map(row => {
      const id = get(row, 'LeaseId'); if (!id) return null
      const ex = existMap[id]
      return {
        lease_id: id, lease_link: get(row, 'LeaseLink'), home_id: get(row, 'HomeId'),
        address: get(row, 'Address').replace(/^"|"$/g, ''), concierge: get(row, 'Concierge'),
        homeowner_name: get(row, 'HomeownerName'), lease_type: get(row, 'LeaseType'),
        payout_plan: get(row, 'PayoutPlan'), rent_amount: parseFloat(get(row, 'RentAmount')) || 0,
        rent_payout_status: get(row, 'RentPayoutStatus'),
        open_payable_count: parseInt(get(row, 'OpenPayableCount')) || 0,
        open_payable_balance: parseFloat(get(row, 'OpenPayableBalance')) || 0,
        first_open_payable_month: get(row, 'FirstOpenPayableMonth') || null,
        last_open_payable_month: get(row, 'LastOpenPayableMonth') || null,
        lease_start_on: parseDate(get(row, 'LeaseStartOn')), lease_end_on: parseDate(get(row, 'LeaseEndOn')),
        terminated_on: parseDate(get(row, 'TerminatedOn')), notice_type: get(row, 'NoticeType') || null,
        lease_status: get(row, 'Status'), agreement_status: get(row, 'AgreementStatus'),
        manual_status: ex?.manual_status ?? null, notes: ex?.notes ?? null, escalated: ex?.escalated ?? false,
        updated_at: new Date().toISOString(),
      }
    }).filter(Boolean)

    for (let i = 0; i < leaseRows.length; i += 100) {
      const { error } = await supabase.from('leases').upsert(leaseRows.slice(i, i + 100) as any[], { onConflict: 'lease_id' })
      if (error) throw error
    }
    return NextResponse.json({ success: true, leases: leaseRows.length })
  } catch (err) { return NextResponse.json({ error: String(err) }, { status: 500 }) }
}
