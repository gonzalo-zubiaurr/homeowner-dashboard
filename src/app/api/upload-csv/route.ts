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

    // Build CSV home_id → lease_id map
    const csvHomeToLease: Record<string, string> = {}
    const csvLeaseIds: Set<string> = new Set()
    for (const row of rows) {
      const homeId = get(row, 'HomeId')
      const leaseId = get(row, 'LeaseId')
      if (homeId && leaseId) {
        csvHomeToLease[homeId] = leaseId
        csvLeaseIds.add(leaseId)
      }
    }

    // Fetch ALL existing leases from Supabase
    const { data: existing, error: fetchError } = await supabase
      .from('leases')
      .select('lease_id,home_id,manual_status,notes,escalated,intercom_link,escalation_slack_link,tags')
    if (fetchError) console.error('[upload-csv] Fetch existing error:', fetchError)

    // Build maps: by lease_id and by home_id
    const existByLeaseId: Record<string, any> = {}
    const existByHomeId: Record<string, any[]> = {}
    for (const l of (existing || [])) {
      existByLeaseId[l.lease_id] = l
      if (!existByHomeId[l.home_id]) existByHomeId[l.home_id] = []
      existByHomeId[l.home_id].push(l)
    }

    // For each home in CSV, find old leases that are being replaced
    // and collect their manual data to carry over
    const manualDataByHome: Record<string, any> = {}
    const leaseIdsToDelete: string[] = []

    for (const [homeId, newLeaseId] of Object.entries(csvHomeToLease)) {
      const oldLeases = existByHomeId[homeId] || []
      for (const oldLease of oldLeases) {
        if (oldLease.lease_id !== newLeaseId) {
          // This is an old lease being replaced — carry over manual data
          if (!manualDataByHome[homeId]) {
            manualDataByHome[homeId] = {
              manual_status: oldLease.manual_status ?? null,
              notes: oldLease.notes ?? null,
              escalated: oldLease.escalated ?? false,
              intercom_link: oldLease.intercom_link ?? null,
              escalation_slack_link: oldLease.escalation_slack_link ?? null,
              tags: oldLease.tags ?? [],
            }
          }
          leaseIdsToDelete.push(oldLease.lease_id)
        }
      }
    }

    // Re-key lease_notes from old lease_ids to new lease_ids
    if (leaseIdsToDelete.length > 0) {
      console.log('[upload-csv] Re-keying notes for replaced leases:', leaseIdsToDelete.length)
      for (const oldLeaseId of leaseIdsToDelete) {
        // Find which home this old lease belonged to
        const oldLease = existByLeaseId[oldLeaseId]
        if (!oldLease) continue
        const newLeaseId = csvHomeToLease[oldLease.home_id]
        if (!newLeaseId || newLeaseId === oldLeaseId) continue

        // Update lease_notes to point to new lease_id
        const { error: notesError } = await supabase
          .from('lease_notes')
          .update({ lease_id: newLeaseId })
          .eq('lease_id', oldLeaseId)
        if (notesError) console.error('[upload-csv] Notes re-key error:', notesError)
      }
    }

    // Build new lease rows
    const leaseRows = rows.map(row => {
      const id = get(row, 'LeaseId')
      if (!id) return null
      const homeId = get(row, 'HomeId')

      // Priority: existing same lease_id → carried over from old lease → defaults
      const exSame = existByLeaseId[id]
      const exCarried = manualDataByHome[homeId]
      const ex = exSame || exCarried

      return {
        lease_id: id,
        lease_link: get(row, 'LeaseLink'),
        home_id: homeId,
        address: get(row, 'Address').replace(/^"|"$/g, ''),
        concierge: get(row, 'Concierge'),
        homeowner_name: get(row, 'HomeownerName'),
        homeowner_id: get(row, 'HomeownerId') || null,
        homeowner_link: get(row, 'HomeownerLink') || null,
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
        first_open_payable_balance_note: get(row, 'FirstOpenPayableBalanceNote') || null,
        last_open_payable_balance_id: get(row, 'LastOpenPayableBalanceId') || null,
        last_open_payable_balance_link: get(row, 'LastOpenPayableBalanceLink') || null,
        last_open_payable_balance_note: get(row, 'LastOpenPayableBalanceNote') || null,
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
        intercom_link: ex?.intercom_link ?? null,
        escalation_slack_link: ex?.escalation_slack_link ?? null,
        tags: ex?.tags ?? [],
        updated_at: new Date().toISOString(),
      }
    }).filter(Boolean)

    // Upsert new leases
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

    // Delete old replaced leases
    if (leaseIdsToDelete.length > 0) {
      console.log('[upload-csv] Deleting old leases:', leaseIdsToDelete.length)
      for (let i = 0; i < leaseIdsToDelete.length; i += 100) {
        const batch = leaseIdsToDelete.slice(i, i + 100)
        const { error } = await supabase
          .from('leases')
          .delete()
          .in('lease_id', batch)
        if (error) console.error('[upload-csv] Delete old leases error:', error)
      }
    }

    console.log('[upload-csv] Done')
    return NextResponse.json({ success: true, leases: leaseRows.length, deleted: leaseIdsToDelete.length })
  } catch (err) {
    console.error('[upload-csv] Caught error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
