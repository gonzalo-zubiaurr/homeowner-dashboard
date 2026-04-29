'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase, CHECKLIST_ITEMS, computeStatus, STATUS_CONFIG, type Lease, type ChecklistMap, type ComputedStatus } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────
type FilterState = {
  concierges: string[]
  payoutPlans: string[]
  leaseTypes: string[]
  agreementStatus: string
  month: string
  dateFrom: string
  dateTo: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
function pct(n: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((n / total) * 100)}%`
}

function fmt(n: number, total: number) {
  return `${n} (${pct(n, total)})`
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ── Sub-components ─────────────────────────────────────────────────────────
function StatusCard({ status, count, total, selected, onClick }: { status: ComputedStatus; count: number; total: number; selected: boolean; onClick: () => void }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '16px 20px', borderRadius: 12, background: selected ? cfg.bg : '#fff', border: `1.5px solid ${selected ? cfg.color : '#E2E8F0'}`, cursor: 'pointer', transition: 'all 0.2s', boxShadow: selected ? `0 0 0 3px ${cfg.color}20` : '0 1px 3px rgba(0,0,0,0.05)', minWidth: 130 }}>
      <span style={{ fontSize: 28, fontWeight: 700, color: cfg.color, fontFamily: 'Montserrat, sans-serif' }}>{count}</span>
      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, fontFamily: 'Montserrat, sans-serif', marginTop: 2 }}>{cfg.label}</span>
      <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'Montserrat, sans-serif', marginTop: 2 }}>{pct(count, total)} of total</span>
    </button>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 24 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F4F8' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  )
}

function MultiSelectFilter({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v])
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ ...selStyle, display: 'flex', alignItems: 'center', gap: 6, minWidth: 140 }}>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {selected.length === 0 ? label : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
        <span style={{ fontSize: 10 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 180, maxHeight: 240, overflowY: 'auto', marginTop: 4 }}>
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

// Simple bar chart
function BarChart({ data, color = '#2C4F6B', valueFormatter = (v: number) => String(v) }: { data: { label: string; value: number }[]; color?: string; valueFormatter?: (v: number) => string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'Montserrat, sans-serif', width: 80, textAlign: 'right', flexShrink: 0 }}>{d.label}</span>
          <div style={{ flex: 1, height: 20, background: '#F0F4F8', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', width: 70, flexShrink: 0 }}>{valueFormatter(d.value)}</span>
        </div>
      ))}
    </div>
  )
}

// Inline lease list (for drilldown)
function LeaseList({ leases, checklist, title, onClose }: { leases: Lease[]; checklist: ChecklistMap; title: string; onClose: () => void }) {
  return (
    <div style={{ marginTop: 16, background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #E2E8F0', background: '#fff' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif' }}>{title} — {leases.length} leases</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href="/" target="_blank" style={{ fontSize: 11, color: '#2C4F6B', fontWeight: 700, fontFamily: 'Montserrat, sans-serif', textDecoration: 'underline' }}>Open Tracker ↗</a>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94A3B8' }}>✕</button>
        </div>
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'Montserrat, sans-serif' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Address', 'Homeowner', 'Concierge', 'Lease Start', 'Rent', 'Status', 'Setup'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em' }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leases.map((l, i) => {
              const done = CHECKLIST_ITEMS.filter(item => checklist[l.home_id]?.[item.key]).length
              const status = computeStatus(l, done)
              const cfg = STATUS_CONFIG[status]
              return (
                <tr key={l.lease_id} style={{ borderBottom: '1px solid #F0F4F8', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <a href={`https://foundation.bln.hm/homes/${l.home_id}`} target="_blank" rel="noreferrer" style={{ color: '#2C4F6B', fontWeight: 600, textDecoration: 'underline', fontSize: 11 }}>{l.address?.substring(0, 30)}{l.address?.length > 30 ? '…' : ''}</a>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#1A3A5C', fontWeight: 600 }}>
                    {l.homeowner_link ? <a href={l.homeowner_link} target="_blank" rel="noreferrer" style={{ color: '#2C4F6B', textDecoration: 'underline' }}>{l.homeowner_name}</a> : l.homeowner_name}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#64748B' }}>{l.concierge}</td>
                  <td style={{ padding: '8px 12px', color: '#64748B', whiteSpace: 'nowrap' as const }}>
                    {l.lease_start_on ? <a href={l.lease_link} target="_blank" rel="noreferrer" style={{ color: '#2C4F6B', textDecoration: 'underline' }}>{new Date(l.lease_start_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</a> : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#1A3A5C', fontWeight: 600 }}>${l.rent_amount?.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg }}>{cfg.label}</span></td>
                  <td style={{ padding: '8px 12px', color: done === 5 ? '#0A6B4A' : '#F59E0B', fontWeight: 700 }}>{done}/5</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [leases, setLeases] = useState<Lease[]>([])
  const [checklist, setChecklist] = useState<ChecklistMap>({})
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<ComputedStatus | null>(null)
  const [selectedChecklist, setSelectedChecklist] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({ concierges: [], payoutPlans: ['Monthly'], leaseTypes: ['New'], agreementStatus: 'active', month: '', dateFrom: '', dateTo: '' })

  const loadData = useCallback(async () => {
    const [{ data: lData }, { data: cData }] = await Promise.all([
      supabase.from('leases').select('*'),
      supabase.from('checklist_items').select('*'),
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
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.replace('/login'); return }
      loadData()
    })
  }, [loadData])

  const allConcierges = Array.from(new Set(leases.map(l => l.concierge).filter(Boolean))).sort()
  const allLeaseTypes = Array.from(new Set(leases.map(l => l.lease_type).filter(Boolean))).sort()

  const matchesDate = (lease: Lease) => {
    const d = lease.lease_start_on ? new Date(lease.lease_start_on) : null
    if (!d) return true
    if (filters.month) {
      const [mon, yr] = filters.month.split(' ')
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      return d.getMonth() === months.indexOf(mon) && d.getFullYear() === parseInt(yr)
    }
    if (filters.dateFrom) { const from = new Date(filters.dateFrom); if (d < from) return false }
    if (filters.dateTo) { const to = new Date(filters.dateTo); if (d > to) return false }
    return true
  }

  const filtered = leases.filter(l => {
    if (filters.agreementStatus === 'active' && l.agreement_status?.toLowerCase() !== 'active') return false
    if (filters.agreementStatus === 'inactive' && l.agreement_status?.toLowerCase() !== 'inactive') return false
    if (filters.concierges.length > 0 && !filters.concierges.includes(l.concierge)) return false
    if (filters.payoutPlans.length > 0 && !filters.payoutPlans.includes(l.payout_plan)) return false
    if (filters.leaseTypes.length > 0 && !filters.leaseTypes.includes(l.lease_type)) return false
    if (!matchesDate(l)) return false
    return true
  })

  const getDone = (l: Lease) => CHECKLIST_ITEMS.filter(i => checklist[l.home_id]?.[i.key]).length
  const getStatus = (l: Lease) => computeStatus(l, getDone(l))

  // Section 1 — Status breakdown
  const statusCounts: Record<ComputedStatus, Lease[]> = { failed: [], ready_to_process: [], processing: [], ready_to_pay: [], pending: [], paid: [] }
  filtered.forEach(l => statusCounts[getStatus(l)].push(l))
  const totalRentAtRisk = filtered.filter(l => getStatus(l) !== 'paid').reduce((sum, l) => sum + (l.rent_amount || 0), 0)
  const totalOpenBalance = filtered.reduce((sum, l) => sum + (l.open_payable_balance || 0), 0)

  // Section 2 — Concierge performance
  const conciergeNames = Array.from(new Set(filtered.map(l => l.concierge).filter(Boolean))).sort()
  const conciergeRows = conciergeNames.map(name => {
    const cls = filtered.filter(l => l.concierge === name)
    const paid = cls.filter(l => getStatus(l) === 'paid')
    const unpaid = cls.filter(l => getStatus(l) !== 'paid')
    const noNotes = unpaid.filter(l => !l.notes?.trim())
    const noIntercom = unpaid.filter(l => !l.intercom_link?.trim())
    const escalated = unpaid.filter(l => l.escalated)
    const zeroSetup = unpaid.filter(l => getDone(l) === 0)
    const missingByItem = CHECKLIST_ITEMS.map(item => ({
      key: item.key, label: item.label,
      count: unpaid.filter(l => !checklist[l.home_id]?.[item.key]).length
    }))
    return { name, total: cls.length, paid, unpaid, noNotes, noIntercom, escalated, zeroSetup, missingByItem }
  })

  // Totals row
  const totals = {
    total: filtered.length,
    paid: filtered.filter(l => getStatus(l) === 'paid').length,
    unpaid: filtered.filter(l => getStatus(l) !== 'paid').length,
    noNotes: filtered.filter(l => getStatus(l) !== 'paid' && !l.notes?.trim()).length,
    noIntercom: filtered.filter(l => getStatus(l) !== 'paid' && !l.intercom_link?.trim()).length,
    escalated: filtered.filter(l => l.escalated).length,
    zeroSetup: filtered.filter(l => getStatus(l) !== 'paid' && getDone(l) === 0).length,
    missingByItem: CHECKLIST_ITEMS.map(item => ({
      key: item.key, label: item.label,
      count: filtered.filter(l => getStatus(l) !== 'paid' && !checklist[l.home_id]?.[item.key]).length
    }))
  }

  // Section 3 — Checklist breakdown
  const checklistBreakdown = CHECKLIST_ITEMS.map(item => ({
    ...item,
    missing: filtered.filter(l => !checklist[l.home_id]?.[item.key]),
    complete: filtered.filter(l => !!checklist[l.home_id]?.[item.key]),
  }))

  // Section 4 — Trends
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const leasesByMonth = MONTHS.map(mon => ({
    label: mon, value: leases.filter(l => {
      const d = l.lease_start_on ? new Date(l.lease_start_on) : null
      return d && MONTHS[d.getMonth()] === mon && d.getFullYear() === 2026
    }).length
  })).filter(d => d.value > 0)

  const balanceByMonth = MONTHS.map(mon => ({
    label: mon, value: leases.filter(l => l.first_open_payable_month?.startsWith(mon)).reduce((sum, l) => sum + (l.open_payable_balance || 0), 0)
  })).filter(d => d.value > 0)

  const setupByConcierge = conciergeNames.map(name => {
    const cls = filtered.filter(l => l.concierge === name)
    const totalItems = cls.length * CHECKLIST_ITEMS.length
    const doneItems = cls.reduce((sum, l) => sum + getDone(l), 0)
    return { label: name.split(' ')[0], value: totalItems ? Math.round((doneItems / totalItems) * 100) : 0 }
  }).sort((a, b) => b.value - a.value).slice(0, 10)

  const rentByType = Array.from(new Set(filtered.map(l => l.lease_type))).map(type => ({
    label: type, value: filtered.filter(l => l.lease_type === type && getStatus(l) !== 'paid').reduce((sum, l) => sum + (l.rent_amount || 0), 0)
  })).filter(d => d.value > 0).sort((a, b) => b.value - a.value)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16, background: '#F5F7FA' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#2C4F6B', fontFamily: 'Montserrat, sans-serif' }}>belong<span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#2DD4A0', marginLeft: 2, verticalAlign: 'middle' }} /></div>
      <div style={{ width: 24, height: 24, border: '3px solid #E2E8F0', borderTop: '3px solid #2DD4A0', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#2C4F6B', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 2px 12px rgba(44,79,107,0.18)' }}>
        <div style={{ padding: '13px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>belong<span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#2DD4A0', marginLeft: 2, verticalAlign: 'middle' }} /></div>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ display: 'flex', gap: 4 }}>
            <a href="/" style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontFamily: 'Montserrat, sans-serif' }}>Tracker</a>
            <a href="/reports" style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.15)', textDecoration: 'none', fontFamily: 'Montserrat, sans-serif' }}>Reports</a>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        {/* Summary KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Leases', value: filtered.length, color: '#2C4F6B', bg: '#EEF3F7' },
            { label: 'Rent at Risk', value: fmtMoney(totalRentAtRisk), color: '#DC2626', bg: '#FEF2F2' },
            { label: 'Open Balance', value: fmtMoney(totalOpenBalance), color: '#F59E0B', bg: '#FFFBEB' },
            { label: 'Fully Setup', value: filtered.filter(l => getDone(l) === 5).length, color: '#0A6B4A', bg: '#E8FBF5' },
            { label: 'Escalated', value: filtered.filter(l => l.escalated).length, color: '#DC2626', bg: '#FEF2F2' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '16px', border: `1.5px solid ${k.bg}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '14px 16px', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <MultiSelectFilter label="All Concierges" options={allConcierges} selected={filters.concierges} onChange={v => setFilters(f => ({ ...f, concierges: v }))} />
            <MultiSelectFilter label="Payout Plan" options={['Monthly', 'NoGuarantee']} selected={filters.payoutPlans} onChange={v => setFilters(f => ({ ...f, payoutPlans: v }))} />
            <MultiSelectFilter label="Lease Type" options={allLeaseTypes} selected={filters.leaseTypes} onChange={v => setFilters(f => ({ ...f, leaseTypes: v }))} />
            <select value={filters.agreementStatus} onChange={e => setFilters(f => ({ ...f, agreementStatus: e.target.value }))} style={selStyle}>
              <option value="active">Active Agreements</option>
              <option value="inactive">Inactive</option>
              <option value="">All</option>
            </select>
            <select value={filters.month} onChange={e => setFilters(f => ({ ...f, month: e.target.value, dateFrom: '', dateTo: '' }))} style={selStyle}>
              <option value="">All Months</option>
              {['Jan 2026','Feb 2026','Mar 2026','Apr 2026','May 2026','Jun 2026','Jul 2026','Aug 2026','Sep 2026','Oct 2026','Nov 2026','Dec 2026'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value, month: '' }))} style={{ ...selStyle, width: 130 }} />
            <span style={{ fontSize: 11, color: '#94A3B8' }}>→</span>
            <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value, month: '' }))} style={{ ...selStyle, width: 130 }} />
            <button onClick={() => setFilters({ concierges: [], payoutPlans: ['Monthly'], leaseTypes: ['New'], agreementStatus: 'active', month: '', dateFrom: '', dateTo: '' })}
              style={{ padding: '8px 12px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#94A3B8', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Reset</button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>{filtered.length} leases</span>
          </div>
        </div>

        {/* Section 1 — Status Breakdown */}
        <SectionCard title="📊 Status Breakdown">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: selectedStatus ? 16 : 0 }}>
            {(Object.keys(statusCounts) as ComputedStatus[]).map(s => (
              <StatusCard key={s} status={s} count={statusCounts[s].length} total={filtered.length} selected={selectedStatus === s} onClick={() => setSelectedStatus(selectedStatus === s ? null : s)} />
            ))}
          </div>
          {selectedStatus && statusCounts[selectedStatus].length > 0 && (
            <LeaseList leases={statusCounts[selectedStatus]} checklist={checklist} title={STATUS_CONFIG[selectedStatus].label} onClose={() => setSelectedStatus(null)} />
          )}
        </SectionCard>

        {/* Section 2 — Concierge Performance */}
        <SectionCard title="👥 Concierge Performance">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'Montserrat, sans-serif' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                  {['Concierge', 'Total', 'Paid', 'Unpaid', 'No Notes', 'No Intercom', 'Escalated', '0/5 Setup',
                    ...CHECKLIST_ITEMS.map(i => `No ${i.label}`)].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em', whiteSpace: 'nowrap' as const }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conciergeRows.map((row, i) => (
                  <tr key={row.name} style={{ borderBottom: '1px solid #F0F4F8', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1A3A5C', whiteSpace: 'nowrap' as const }}>{row.name}</td>
                    <td style={{ padding: '10px 12px', color: '#64748B' }}>{row.total}</td>
                    <td style={{ padding: '10px 12px', color: '#0A6B4A', fontWeight: 600 }}>{fmt(row.paid.length, row.total)}</td>
                    <td style={{ padding: '10px 12px', color: row.unpaid.length > 0 ? '#DC2626' : '#64748B', fontWeight: 600 }}>{fmt(row.unpaid.length, row.total)}</td>
                    <td style={{ padding: '10px 12px', color: row.noNotes.length > 0 ? '#F59E0B' : '#64748B' }}>{fmt(row.noNotes.length, row.unpaid.length)}</td>
                    <td style={{ padding: '10px 12px', color: row.noIntercom.length > 0 ? '#F59E0B' : '#64748B' }}>{fmt(row.noIntercom.length, row.unpaid.length)}</td>
                    <td style={{ padding: '10px 12px', color: row.escalated.length > 0 ? '#DC2626' : '#64748B' }}>{fmt(row.escalated.length, row.unpaid.length)}</td>
                    <td style={{ padding: '10px 12px', color: row.zeroSetup.length > 0 ? '#DC2626' : '#64748B' }}>{fmt(row.zeroSetup.length, row.unpaid.length)}</td>
                    {row.missingByItem.map(m => (
                      <td key={m.key} style={{ padding: '10px 12px', color: m.count > 0 ? '#F59E0B' : '#64748B' }}>{fmt(m.count, row.unpaid.length)}</td>
                    ))}
                  </tr>
                ))}
                {/* Totals row */}
                <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC', fontWeight: 700 }}>
                  <td style={{ padding: '10px 12px', color: '#1A3A5C', fontWeight: 700 }}>TOTAL</td>
                  <td style={{ padding: '10px 12px', color: '#1A3A5C' }}>{totals.total}</td>
                  <td style={{ padding: '10px 12px', color: '#0A6B4A' }}>{fmt(totals.paid, totals.total)}</td>
                  <td style={{ padding: '10px 12px', color: '#DC2626' }}>{fmt(totals.unpaid, totals.total)}</td>
                  <td style={{ padding: '10px 12px', color: '#F59E0B' }}>{fmt(totals.noNotes, totals.unpaid)}</td>
                  <td style={{ padding: '10px 12px', color: '#F59E0B' }}>{fmt(totals.noIntercom, totals.unpaid)}</td>
                  <td style={{ padding: '10px 12px', color: '#DC2626' }}>{fmt(totals.escalated, totals.unpaid)}</td>
                  <td style={{ padding: '10px 12px', color: '#DC2626' }}>{fmt(totals.zeroSetup, totals.unpaid)}</td>
                  {totals.missingByItem.map(m => (
                    <td key={m.key} style={{ padding: '10px 12px', color: '#F59E0B' }}>{fmt(m.count, totals.unpaid)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Section 3 — Checklist Breakdown */}
        <SectionCard title="✅ Setup Checklist Breakdown">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: selectedChecklist ? 16 : 0 }}>
            {checklistBreakdown.map(item => (
              <button key={item.key} onClick={() => setSelectedChecklist(selectedChecklist === item.key ? null : item.key)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '14px 18px', borderRadius: 10, background: selectedChecklist === item.key ? '#FEF2F2' : '#fff', border: `1.5px solid ${selectedChecklist === item.key ? '#FCA5A5' : '#E2E8F0'}`, cursor: 'pointer', transition: 'all 0.2s', minWidth: 140 }}>
                <span style={{ fontSize: 18, marginBottom: 4 }}>{item.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1A3A5C' }}>{item.label}</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#DC2626', marginTop: 4 }}>{item.missing.length}</span>
                <span style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>missing · {pct(item.missing.length, filtered.length)} of leases</span>
                <span style={{ fontSize: 10, color: '#0A6B4A', marginTop: 2 }}>{item.complete.length} complete</span>
              </button>
            ))}
          </div>
          {selectedChecklist && (
            <LeaseList
              leases={checklistBreakdown.find(i => i.key === selectedChecklist)?.missing || []}
              checklist={checklist}
              title={`Missing ${checklistBreakdown.find(i => i.key === selectedChecklist)?.label}`}
              onClose={() => setSelectedChecklist(null)}
            />
          )}
        </SectionCard>

        {/* Section 4 — Trends */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 24 }}>
          <SectionCard title="📅 Leases Starting by Month (2026)">
            <BarChart data={leasesByMonth} color="#2C4F6B" />
          </SectionCard>
          <SectionCard title="💸 Open Balance by Month">
            <BarChart data={balanceByMonth} color="#DC2626" valueFormatter={fmtMoney} />
          </SectionCard>
          <SectionCard title="✅ Setup Completion by Concierge (%)">
            <BarChart data={setupByConcierge} color="#2DD4A0" valueFormatter={v => `${v}%`} />
          </SectionCard>
          <SectionCard title="🏠 Rent at Risk by Lease Type">
            <BarChart data={rentByType} color="#F59E0B" valueFormatter={fmtMoney} />
          </SectionCard>
        </div>

        <div style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 8 }}>belong · Homeowner Payouts Reports · Internal Use Only</div>
      </div>
    </div>
  )
}

const selStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#F8FAFC',
  color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', fontSize: 12, outline: 'none', cursor: 'pointer',
}
