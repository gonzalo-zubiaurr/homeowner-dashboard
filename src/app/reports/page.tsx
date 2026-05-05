'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, CHECKLIST_ITEMS, type Lease, type ChecklistMap } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type PanelLease = {
  address: string; homeowner_name: string; homeowner_link?: string | null
  lease_link?: string | null; lease_start_on?: string | null
  lease_type: string; rent_payout_status: string; rent_amount: number
  lease_id: string
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const today = new Date()
const startOfYear = new Date(today.getFullYear(), 0, 1)
const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

const QUARTER_NUM = Math.floor(today.getMonth() / 3) + 1
const QUARTER_LABEL = `Q${QUARTER_NUM} ${today.getFullYear()}`
const MONTH_LABEL = today.toLocaleString('en-US', { month: 'long', year: 'numeric' })
const MONTH_NAME = today.toLocaleString('en-US', { month: 'long', year: 'numeric' })

// ── Lease helpers ─────────────────────────────────────────────────────────────

function isStarted(l: Lease) {
  if (!l.lease_start_on) return false
  return new Date(l.lease_start_on) <= today
}

function isUpcoming(l: Lease) {
  if (!l.lease_start_on) return false
  return new Date(l.lease_start_on) > today
}

function isPaid(l: Lease) { return l.rent_payout_status?.toLowerCase() === 'paid' }
function isGuaranteed(l: Lease) { return l.payout_plan === 'Monthly' }

function startedSince(l: Lease, since: Date) {
  if (!l.lease_start_on) return false
  const d = new Date(l.lease_start_on)
  return d >= since && d <= today
}

function pct(n: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((n / total) * 100)}%`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ value, label, sublabel, color, onClick }: {
  value: number | string; label: string; sublabel?: string
  color: string; onClick?: () => void
}) {
  return (
    <button onClick={onClick} disabled={!onClick}
      style={{
        background: '#fff', border: `1.5px solid ${color}30`,
        borderRadius: 12, padding: '16px 20px', textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default', flex: 1, minWidth: 140,
        transition: 'all 0.15s', boxShadow: onClick ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
      }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'Montserrat, sans-serif', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', marginTop: 4 }}>{label}</div>
      {sublabel && <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'Montserrat, sans-serif', marginTop: 2 }}>{sublabel}</div>}
    </button>
  )
}

function HealthSection({ title, subtitle, leases, getDone, openPanel }: {
  title: string; subtitle: string; leases: Lease[]
  getDone: (l: Lease) => number
  openPanel: (title: string, ls: Lease[]) => void
}) {
  const guaranteed = leases.filter(isGuaranteed)
  const nonGuaranteed = leases.filter(l => !isGuaranteed(l))
  const guaranteedPaid = guaranteed.filter(isPaid)
  const nonGuaranteedPaid = nonGuaranteed.filter(isPaid)
  const totalPaid = leases.filter(isPaid)

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'Montserrat, sans-serif', marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard value={leases.length} label="Total Leases" sublabel="Started in period" color="#1A3A5C" />
        <StatCard
          value={`${guaranteedPaid.length} · ${pct(guaranteedPaid.length, guaranteed.length)}`}
          label="Guaranteed Paid"
          sublabel={`of ${guaranteed.length} guaranteed`}
          color="#059669"
          onClick={() => openPanel(`${title} — Guaranteed Paid`, guaranteedPaid)}
        />
        <StatCard
          value={`${nonGuaranteedPaid.length} · ${pct(nonGuaranteedPaid.length, nonGuaranteed.length)}`}
          label="Non-Guarantee Paid"
          sublabel={`of ${nonGuaranteed.length} non-guarantee`}
          color="#0891B2"
          onClick={() => openPanel(`${title} — Non-Guarantee Paid`, nonGuaranteedPaid)}
        />
        <StatCard
          value={`${totalPaid.length} · ${pct(totalPaid.length, leases.length)}`}
          label="Total Rent Paid"
          sublabel={`of ${leases.length} started leases`}
          color="#2DD4A0"
          onClick={() => openPanel(`${title} — Total Paid`, totalPaid)}
        />
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'Montserrat, sans-serif', marginTop: 2 }}>{subtitle}</div>}
    </div>
  )
}

function FilterBar({ concierges, leaseTypes, selConcierges, selTypes, onConcierges, onTypes, onReset }: {
  concierges: string[]; leaseTypes: string[]
  selConcierges: string[]; selTypes: string[]
  onConcierges: (v: string[]) => void; onTypes: (v: string[]) => void; onReset: () => void
}) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
      <MultiSelect label="All Concierges" options={concierges} selected={selConcierges} onChange={onConcierges} />
      <MultiSelect label="All Lease Types" options={leaseTypes} selected={selTypes} onChange={onTypes} />
      <button onClick={onReset} style={{ padding: '7px 12px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#94A3B8', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'Montserrat, sans-serif' }}>Reset</button>
    </div>
  )
}

function MultiSelect({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!(e.target as Element).closest('[data-ms]')) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div data-ms style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ padding: '7px 12px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#1A3A5C', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', gap: 6, minWidth: 160 }}>
        <span style={{ flex: 1, textAlign: 'left' }}>{selected.length === 0 ? label : selected.length === 1 ? selected[0] : `${selected.length} selected`}</span>
        <span style={{ fontSize: 10, color: '#94A3B8' }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 200, maxHeight: 260, overflowY: 'auto', marginTop: 4 }}>
          {selected.length > 0 && <button onClick={() => { onChange([]); setOpen(false) }} style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid #F0F4F8', cursor: 'pointer', fontSize: 11, color: '#DC2626', fontWeight: 700, textAlign: 'left', fontFamily: 'Montserrat, sans-serif' }}>Clear all</button>}
          {options.map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F8FAFC' }}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} style={{ accentColor: '#2C4F6B' }} />
              <span style={{ fontSize: 12, color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif' }}>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Side Panel ────────────────────────────────────────────────────────────────

function ReportSidePanel({ title, leases, trackerHref, onClose }: {
  title: string; leases: PanelLease[]; trackerHref?: string; onClose: () => void
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 99 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, width: 520, height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 100, display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat, sans-serif' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1A3A5C' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{leases.length} lease{leases.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {trackerHref && (
              <a href={trackerHref} style={{ padding: '7px 14px', borderRadius: 8, background: '#EEF3F7', color: '#2C4F6B', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                Open in Tracker ↗
              </a>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94A3B8' }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                {['Address', 'Homeowner', 'Start', 'Type', 'Status', 'Rent'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leases.map((l, i) => (
                <tr key={l.lease_id} style={{ borderBottom: '1px solid #F0F4F8', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                  <td style={{ padding: '10px 14px', maxWidth: 180 }}>
                    {l.lease_link
                      ? <a href={l.lease_link} target="_blank" rel="noreferrer" style={{ color: '#2C4F6B', fontWeight: 600, textDecoration: 'underline', fontSize: 11 }}>{l.address}</a>
                      : <span style={{ fontSize: 11, color: '#1A3A5C', fontWeight: 600 }}>{l.address}</span>}
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    {l.homeowner_link
                      ? <a href={l.homeowner_link} target="_blank" rel="noreferrer" style={{ color: '#2C4F6B', fontWeight: 600, textDecoration: 'underline', fontSize: 11 }}>{l.homeowner_name}</a>
                      : <span style={{ fontSize: 11, color: '#1A3A5C' }}>{l.homeowner_name}</span>}
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: 11, color: '#64748B' }}>
                    {l.lease_start_on ? new Date(l.lease_start_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: '#6D28D9', background: '#F5F3FF' }}>{l.lease_type}</span>
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, color: l.rent_payout_status?.toLowerCase() === 'paid' ? '#059669' : '#DC2626', fontWeight: 600 }}>{l.rent_payout_status}</span>
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, color: '#1A3A5C' }}>${l.rent_amount?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [leases, setLeases] = useState<Lease[]>([])
  const [checklist, setChecklist] = useState<ChecklistMap>({})
  const [notesMap, setNotesMap] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [selConcierges, setSelConcierges] = useState<string[]>([])
  const [selTypes, setSelTypes] = useState<string[]>([])
  const [panel, setPanel] = useState<{ title: string; leases: PanelLease[]; trackerHref?: string } | null>(null)
  const [trackerSortCol, setTrackerSortCol] = useState<string>('failed')
  const [trackerSortDir, setTrackerSortDir] = useState<'asc' | 'desc'>('desc')

  const handleTrackerSort = (col: string) => {
    if (trackerSortCol === col) setTrackerSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setTrackerSortCol(col); setTrackerSortDir('desc') }
  }

  const loadData = useCallback(async () => {
    const [{ data: lData }, { data: cData }, { data: nData }] = await Promise.all([
      supabase.from('leases').select('*'),
      supabase.from('checklist_items').select('*'),
      supabase.from('lease_notes').select('*'),
    ])
    if (lData) setLeases(lData)
    if (cData) {
      const map: ChecklistMap = {}
      for (const item of cData) {
        if (!map[item.home_id]) map[item.home_id] = {}
        map[item.home_id][item.item_key] = item.completed
      }
      setChecklist(map)
    }
    if (nData) {
      const map: Record<string, any[]> = {}
      for (const n of nData) {
        if (!map[n.lease_id]) map[n.lease_id] = []
        map[n.lease_id].push(n)
      }
      setNotesMap(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.replace('/login'); return }
      loadData()
    })
  }, [loadData])

  const getDone = (l: Lease) => CHECKLIST_ITEMS.filter(i => checklist[l.home_id]?.[i.key]).length
  const getSetupComplete = (l: Lease) => getDone(l) === CHECKLIST_ITEMS.length

  const toPanelLease = (l: Lease): PanelLease => ({
    lease_id: l.lease_id, address: l.address, homeowner_name: l.homeowner_name,
    homeowner_link: l.homeowner_link, lease_link: l.lease_link,
    lease_start_on: l.lease_start_on, lease_type: l.lease_type,
    rent_payout_status: l.rent_payout_status, rent_amount: l.rent_amount,
  })

  const openPanel = (title: string, ls: Lease[], trackerParams?: Record<string, string>) => {
    let trackerHref: string | undefined
    if (trackerParams) {
      const params = new URLSearchParams(trackerParams)
      trackerHref = `/?${params.toString()}`
    }
    setPanel({ title, leases: ls.map(toPanelLease), trackerHref })
  }

  const allConcierges = Array.from(new Set(leases.map(l => l.concierge).filter(Boolean))).sort() as string[]
  const allLeaseTypes = Array.from(new Set(leases.map(l => l.lease_type).filter(Boolean))).sort() as string[]

  const applyFilters = (ls: Lease[]) => ls.filter(l =>
    (selConcierges.length === 0 || selConcierges.includes(l.concierge)) &&
    (selTypes.length === 0 || selTypes.includes(l.lease_type))
  )

  // ── Section 1: Health periods (no filters) ────────────────────────────────
  const startedYTD = leases.filter(isStarted)
  const startedQTD = leases.filter(l => startedSince(l, startOfQuarter))
  const startedMTD = leases.filter(l => startedSince(l, startOfMonth))

  // ── Section 2: Operational (filtered) ────────────────────────────────────
  const filteredStarted = applyFilters(leases.filter(isStarted))
  const filteredUpcoming = applyFilters(leases.filter(isUpcoming))

  const rentFailed = filteredStarted.filter(l => {
    const done = getDone(l)
    return !isPaid(l) && l.manual_status !== 'processing' && done < CHECKLIST_ITEMS.length
  })
  const readyToInitiate = filteredStarted.filter(l => {
    const done = getDone(l)
    return !isPaid(l) && l.manual_status !== 'processing' && done === CHECKLIST_ITEMS.length
  })
  const processing = filteredStarted.filter(l => !isPaid(l) && l.manual_status === 'processing')
  const failedTotal = rentFailed.length + readyToInitiate.length + processing.length

  const upcomingTotal = filteredUpcoming
  const upcomingReady = filteredUpcoming.filter(getSetupComplete)
  const upcomingPending = filteredUpcoming.filter(l => !getSetupComplete(l))

  // ── Section 3: Progress Tracker per concierge ────────────────────────────
  const conciergeList = selConcierges.length > 0 ? selConcierges : allConcierges

  const getConciergeLeases = (concierge: string) =>
    leases.filter(l => l.concierge === concierge && (selTypes.length === 0 || selTypes.includes(l.lease_type)))

  // ── Section 4: Failed Detail per concierge ───────────────────────────────
  const getConciergeFailed = (concierge: string) =>
    leases.filter(l => l.concierge === concierge && isStarted(l) && !isPaid(l) && (selTypes.length === 0 || selTypes.includes(l.lease_type)))

  // ── Section 5: Compliance ─────────────────────────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const getConciergeUnpaid = (concierge: string) =>
    leases.filter(l => l.concierge === concierge && isStarted(l) && !isPaid(l) && (selTypes.length === 0 || selTypes.includes(l.lease_type)))

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F5F7FA' }}>
      <div style={{ width: 28, height: 28, border: '3px solid #E2E8F0', borderTop: '3px solid #2DD4A0', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const cardBtn = (n: number, color: string, onClick: () => void) => (
    <button onClick={onClick} style={{ fontSize: 18, fontWeight: 800, color, fontFamily: 'Montserrat, sans-serif', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: n > 0 ? 'underline' : 'none', textUnderlineOffset: 3 }}>
      {n}
    </button>
  )

  const resetFilters = () => { setSelConcierges([]); setSelTypes([]) }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      {/* Nav */}
      <header style={{ background: '#2C4F6B', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 2px 12px rgba(44,79,107,0.18)' }}>
        <div style={{ padding: '13px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
            belong<span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#2DD4A0', marginLeft: 2, verticalAlign: 'middle' }} />
          </div>
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Homeowner Payouts</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Reports</div>
          </div>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ display: 'flex', gap: 4 }}>
            <a href="/" style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Tracker</a>
            <a href="/reports" style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.15)', textDecoration: 'none' }}>Reports</a>
          </div>
        </div>
      </header>

      <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Section 1a: YTD Health ────────────────────────────────────────── */}
        <HealthSection
          title="YTD Payment Health"
          subtitle={`Jan 1 – today · started leases only · as of today`}
          leases={startedYTD}
          getDone={getDone}
          openPanel={openPanel}
        />

        {/* ── Section 1b: QTD Health ────────────────────────────────────────── */}
        <HealthSection
          title={`${QUARTER_LABEL} Payment Health`}
          subtitle={`${startOfQuarter.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – today · started leases only`}
          leases={startedQTD}
          getDone={getDone}
          openPanel={openPanel}
        />

        {/* ── Section 1c: MTD Health ────────────────────────────────────────── */}
        <HealthSection
          title={`${MONTH_LABEL} Payment Health`}
          subtitle={`${startOfMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – today · started leases only`}
          leases={startedMTD}
          getDone={getDone}
          openPanel={openPanel}
        />

        {/* ── Section 2: Operational ───────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <SectionHeader title="Operational Overview" subtitle="Started & upcoming leases · filtered" />
          <FilterBar concierges={allConcierges} leaseTypes={allLeaseTypes} selConcierges={selConcierges} selTypes={selTypes} onConcierges={setSelConcierges} onTypes={setSelTypes} onReset={resetFilters} />

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', marginBottom: 10 }}>CURRENT FAILURES</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <StatCard value={rentFailed.length} label="Rent Failed" sublabel={pct(rentFailed.length, failedTotal) + ' of failed'} color="#DC2626" onClick={() => openPanel('Rent Failed', rentFailed, selConcierges.length === 1 ? { concierge: selConcierges[0] } : undefined)} />
                <StatCard value={readyToInitiate.length} label="Ready to Initiate" sublabel={pct(readyToInitiate.length, failedTotal) + ' of failed'} color="#F59E0B" onClick={() => openPanel('Ready to Initiate', readyToInitiate)} />
                <StatCard value={processing.length} label="Processing" sublabel={pct(processing.length, failedTotal) + ' of failed'} color="#06B6D4" onClick={() => openPanel('Processing', processing)} />
              </div>
            </div>
            <div style={{ width: 1, background: '#E2E8F0', alignSelf: 'stretch' }} />
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', marginBottom: 10 }}>UPCOMING LEASES</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <StatCard value={upcomingTotal.length} label="Total Upcoming" sublabel="Future start date" color="#6D28D9" onClick={() => openPanel('Upcoming Leases', upcomingTotal)} />
                <StatCard value={upcomingReady.length} label="Ready to Pay" sublabel="Setup complete" color="#059669" onClick={() => openPanel('Upcoming — Ready to Pay', upcomingReady)} />
                <StatCard value={upcomingPending.length} label="Pending Setup" sublabel="Setup incomplete" color="#F59E0B" onClick={() => openPanel('Upcoming — Pending Setup', upcomingPending)} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: Progress Tracker per concierge ────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <SectionHeader title="Concierge Progress Tracker" subtitle={`${MONTH_NAME} · by booked balance`} />
          <FilterBar concierges={allConcierges} leaseTypes={allLeaseTypes} selConcierges={selConcierges} selTypes={selTypes} onConcierges={setSelConcierges} onTypes={setSelTypes} onReset={resetFilters} />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                  {[
                    { key: 'concierge', label: 'Concierge' },
                    { key: 'paid', label: 'Paid' },
                    { key: 'failed', label: 'Failed' },
                    { key: 'processing', label: 'Processing' },
                    { key: 'ready', label: 'Ready' },
                    { key: 'upcoming', label: 'Upcoming' },
                    { key: 'upReady', label: 'Setup ✓' },
                    { key: 'upPending', label: 'Pending' },
                  ].map(({ key, label }) => (
                    <th key={key} onClick={() => handleTrackerSort(key)}
                      style={{ padding: '10px 14px', textAlign: key === 'concierge' ? 'left' : 'center', fontSize: 10, fontWeight: 700, color: trackerSortCol === key ? '#2C4F6B' : '#94A3B8', letterSpacing: '0.06em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                      {label.toUpperCase()} {trackerSortCol === key ? (trackerSortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conciergeList.map(concierge => {
                  const all = getConciergeLeases(concierge)
                  const started = all.filter(isStarted)
                  const upcoming = all.filter(isUpcoming)
                  const paid = started.filter(isPaid)
                  const failed = started.filter(l => !isPaid(l) && l.manual_status !== 'processing' && getDone(l) < CHECKLIST_ITEMS.length)
                  const proc = started.filter(l => !isPaid(l) && l.manual_status === 'processing')
                  const ready = started.filter(l => !isPaid(l) && l.manual_status !== 'processing' && getDone(l) === CHECKLIST_ITEMS.length)
                  const upReady = upcoming.filter(getSetupComplete)
                  const upPending = upcoming.filter(l => !getSetupComplete(l))
                  return { concierge, paid, failed, proc, ready, upcoming, upReady, upPending }
                }).sort((a, b) => {
                  let av: any, bv: any
                  if (trackerSortCol === 'concierge') { av = a.concierge; bv = b.concierge }
                  else if (trackerSortCol === 'paid') { av = a.paid.length; bv = b.paid.length }
                  else if (trackerSortCol === 'failed') { av = a.failed.length; bv = b.failed.length }
                  else if (trackerSortCol === 'processing') { av = a.proc.length; bv = b.proc.length }
                  else if (trackerSortCol === 'ready') { av = a.ready.length; bv = b.ready.length }
                  else if (trackerSortCol === 'upcoming') { av = a.upcoming.length; bv = b.upcoming.length }
                  else if (trackerSortCol === 'upReady') { av = a.upReady.length; bv = b.upReady.length }
                  else if (trackerSortCol === 'upPending') { av = a.upPending.length; bv = b.upPending.length }
                  if (av < bv) return trackerSortDir === 'asc' ? -1 : 1
                  if (av > bv) return trackerSortDir === 'asc' ? 1 : -1
                  return 0
                }).map(({ concierge, paid, failed, proc, ready, upcoming, upReady, upPending }, i) => {
                  const tp = { concierge }
                  return (
                    <tr key={concierge} style={{ borderBottom: '1px solid #F0F4F8', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1A3A5C', fontSize: 13 }}>{concierge}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>{cardBtn(paid.length, '#059669', () => openPanel(`${concierge} — Paid`, paid, tp))}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>{cardBtn(failed.length, '#DC2626', () => openPanel(`${concierge} — Failed`, failed, tp))}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>{cardBtn(proc.length, '#06B6D4', () => openPanel(`${concierge} — Processing`, proc, tp))}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>{cardBtn(ready.length, '#F59E0B', () => openPanel(`${concierge} — Ready to Initiate`, ready, tp))}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>{cardBtn(upcoming.length, '#6D28D9', () => openPanel(`${concierge} — Upcoming`, upcoming, tp))}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>{cardBtn(upReady.length, '#059669', () => openPanel(`${concierge} — Setup Complete`, upReady, tp))}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>{cardBtn(upPending.length, '#F59E0B', () => openPanel(`${concierge} — Pending Setup`, upPending, tp))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section 4: Failed Detail per concierge ───────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <SectionHeader title="Failed Payment Detail" subtitle="All started leases · unpaid · broken down by lease type" />
          <FilterBar concierges={allConcierges} leaseTypes={allLeaseTypes} selConcierges={selConcierges} selTypes={selTypes} onConcierges={setSelConcierges} onTypes={setSelTypes} onReset={resetFilters} />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em' }}>CONCIERGE</th>
                  {allLeaseTypes.map(t => (
                    <th key={t} style={{ padding: '10px 14px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em' }}>{t.toUpperCase()}</th>
                  ))}
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {conciergeList.map((concierge, i) => {
                  const failed = getConciergeFailed(concierge)
                  const total = failed.length
                  return (
                    <tr key={concierge} style={{ borderBottom: '1px solid #F0F4F8', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1A3A5C', fontSize: 13 }}>{concierge}</td>
                      {allLeaseTypes.map(t => {
                        const byType = failed.filter(l => l.lease_type === t)
                        return (
                          <td key={t} style={{ padding: '12px 14px', textAlign: 'center' }}>
                            {byType.length > 0
                              ? cardBtn(byType.length, '#DC2626', () => openPanel(`${concierge} — ${t} Failed`, byType, { concierge }))
                              : <span style={{ color: '#CBD5E1', fontSize: 12 }}>—</span>}
                          </td>
                        )
                      })}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {total > 0
                          ? cardBtn(total, '#1A3A5C', () => openPanel(`${concierge} — All Failed`, failed, { concierge }))
                          : <span style={{ color: '#2DD4A0', fontSize: 12, fontWeight: 700 }}>✓</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section 5: Compliance Tracker ────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <SectionHeader title="Compliance Tracker" subtitle="Unpaid leases only · data quality & escalation" />
          <FilterBar concierges={allConcierges} leaseTypes={allLeaseTypes} selConcierges={selConcierges} selTypes={selTypes} onConcierges={setSelConcierges} onTypes={setSelTypes} onReset={resetFilters} />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                  {['Concierge', 'Missing Notes', 'Missing Intercom', 'Note Stale >7d', 'Escalated'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Concierge' ? 'left' : 'center', fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conciergeList.map((concierge, i) => {
                  const unpaid = getConciergeUnpaid(concierge)
                  const missingNotes = unpaid.filter(l => !notesMap[l.lease_id]?.length)
                  const missingIntercom = unpaid.filter(l => !l.intercom_link)
                  const staleNotes = unpaid.filter(l => !l.last_note_at || new Date(l.last_note_at) < sevenDaysAgo)
                  const escalated = unpaid.filter(l => l.escalated)
                  const tp = { concierge }
                  return (
                    <tr key={concierge} style={{ borderBottom: '1px solid #F0F4F8', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1A3A5C', fontSize: 13 }}>{concierge}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {missingNotes.length > 0 ? cardBtn(missingNotes.length, '#DC2626', () => openPanel(`${concierge} — Missing Notes`, missingNotes, tp)) : <span style={{ color: '#2DD4A0', fontSize: 13, fontWeight: 700 }}>✓</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {missingIntercom.length > 0 ? cardBtn(missingIntercom.length, '#F59E0B', () => openPanel(`${concierge} — Missing Intercom`, missingIntercom, tp)) : <span style={{ color: '#2DD4A0', fontSize: 13, fontWeight: 700 }}>✓</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {staleNotes.length > 0 ? cardBtn(staleNotes.length, '#F59E0B', () => openPanel(`${concierge} — Stale Notes`, staleNotes, tp)) : <span style={{ color: '#2DD4A0', fontSize: 13, fontWeight: 700 }}>✓</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {escalated.length > 0 ? cardBtn(escalated.length, '#DC2626', () => openPanel(`${concierge} — Escalated`, escalated, tp)) : <span style={{ color: '#94A3B8', fontSize: 13 }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 20, textAlign: 'center', color: '#CBD5E1', fontSize: 11 }}>belong · Homeowner Payouts Reports · Internal Use Only</div>
      </div>

      {panel && (
        <ReportSidePanel
          title={panel.title}
          leases={panel.leases}
          trackerHref={panel.trackerHref}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  )
}
