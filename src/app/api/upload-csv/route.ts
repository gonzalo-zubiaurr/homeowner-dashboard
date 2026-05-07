import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

function parseDate(val: string): string | null {
  if (!val?.trim()) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export async function POST(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      console.error('[upload-csv] Missing env vars', { url: !!url, key: !!key })
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    const text = await req.text()
    const lines = text.split('\n').filter(l => l.trim())
    const headers = lines[0].split(',').map(h => h.trim())
    console.log('[upload-csv] Headers found:', headers.length, 'Rows:', lines.length - 1)

    const get = (row: string[], key: string) => {
      const i = headers.indexOf(key)
      return i >= 0 ? (row[i] || '').trim() : ''
    }

    const rows: string[][] = []
    for (let i = 1; i < lines.length; i++) {
      const row: string[] = []
      let cur = ''
      let inQ = false
      for (const ch of lines[i]) {
        if (ch === '"') inQ = !inQ
        else if (ch === ',' && !inQ) { row.push(cur.trim()); cur = '' }
        else cur += ch
      }
      row.push(cur.trim())
      if (row.length > 3) rows.push(row)
    }

    // Upsert homes
    const homes = Array.from(new Set(rows.map(r => get(r, 'HomeId')).filter(Boolean))).map(id => {
      const r = rows.find(r => get(r, 'HomeId') === id)!
      return { home_id: id, home_link: get(r, 'HomeLink') }
    })
    console.log('[upload-csv] Upserting homes:', homes.length)
    if (homes.length) {
      const { error } = await supabase.from('homes').upsert(homes, { onConflict: 'home_id' })
      if (error) console.error('[upload-csv] Homes upsert error:', error)
    }

    // Preserve manually-set fields
    const { data: existing, error: fetchError } = await supabase
      .from('leases')
      .select('lease_id,manual_status,notes,escalated')
    if (fetchError) console.error('[upload-csv] Fetch existing error:', fetchError)

    const existMap: Record<string, any> = {}
    for (const l of (existing || [])) existMap[l.lease_id] = l

    const leaseRows = rows.map(row => {
      const id = get(row, 'LeaseId')
      if (!id) return null
      const ex = existMap[id]
      return {
        lease_id: id,
        lease_link: get(row, 'LeaseLink'),
        home_id: get(row, 'HomeId'),
        address: get(row, 'Address').replace(/^"|"$/g, ''),
        concierge: get(row, 'Concierge'),
        homeowner_name: get(row, 'HomeownerName'),
        homeowner_id: get(row, 'HomeownerId') || null,
        homeowner_link: get(row, 'HomeownerLink') || null,
        intercom_link: get(row, 'IntercomLink') || null,
        escalation_slack_link: get(row, 'EscalationSlackLink') || null,
        lease_type: get(row, 'LeaseType'),
        payout_plan: get(row, 'PayoutPlan'),
        rent_amount: parseFloat(get(row, 'RentAmount')) || 0,
        rent_payout_status: get(row, 'RentPayoutStatus'),
        open_payable_count: parseInt(get(row, 'OpenPayableCount')) || 0,
        open_payable_balance: parseFloat(get(row, 'OpenPayableBalance')) || 0,
        first_open_payable_month: get(row, 'FirstOpenPayableMonth') || null,
        last_open_payable_month: get(row, 'LastOpenPayableMonth') || null,
        first_open_payable_balance_id: get(row, 'FirstOpenPayableBalanceId') || null,
        first_open_payable_balance_link: get(row, 'FirstOpenPayableBalanceLink') || null,
        last_open_payable_balance_id: get(row, 'LastOpenPayableBalanceId') || null,
        last_open_payable_balance_link: get(row, 'LastOpenPayableBalanceLink') || null,
        first_open_payable_booked_on: parseDate(get(row, 'FirstOpenPayableBookedOn')),
        last_open_payable_booked_on: parseDate(get(row, 'LastOpenPayableBookedOn')),
        lease_start_on: parseDate(get(row, 'LeaseStartOn')),
        lease_end_on: parseDate(get(row, 'LeaseEndOn')),
        terminated_on: parseDate(get(row, 'TerminatedOn')),
        notice_type: get(row, 'NoticeType') || null,
        lease_status: get(row, 'Status'),
        agreement_status: get(row, 'AgreementStatus'),
        manual_status: ex?.manual_status ?? null,
        notes: ex?.notes ?? null,
        escalated: ex?.escalated ?? false,
        updated_at: new Date().toISOString(),
      }
    }).filter(Boolean)

    console.log('[upload-csv] Upserting leases:', leaseRows.length)
    for (let i = 0; i < leaseRows.length; i += 100) {
      const batch = leaseRows.slice(i, i + 100)
      const { error } = await supabase
        .from('leases')
        .upsert(batch as any[], { onConflict: 'lease_id' })
      if (error) {
        console.error('[upload-csv] Lease upsert error batch', i, error)
        throw error
      }
    }

    console.log('[upload-csv] Done')
    return NextResponse.json({ success: true, leases: leaseRows.length })
  } catch (err) {
    console.error('[upload-csv] Caught error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
