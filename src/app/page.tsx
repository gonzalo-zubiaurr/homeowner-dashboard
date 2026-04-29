'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, CHECKLIST_ITEMS, computeStatus, STATUS_CONFIG, type Lease, type ChecklistMap, type ComputedStatus } from '@/lib/supabase'

const CONCIERGE_TEAMS: Record<string, string[]> = {
  'Team A': ['Maria Rodriguez', 'Sandra Torres', 'Aaron Miranda', 'Marco Estevez'],
  'Team B': ['Belen Manrique Huaranga', 'Vanessa Ortiz Calle', 'Luisa Ramos Palacios'],
  'Team C': ['Mauricio Rivas', 'Enzo Estrada Masgo', 'Anahi Soto Delgado', 'Andre Martorana'],
  'Team D': ['Geraldine Andicoechea', 'Silvana Morán', 'George Moran', 'Luisa Ramos Palacios'],
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${color}30`, whiteSpace: 'nowrap' as const, fontFamily: 'Montserrat, sans-serif' }}>{label}</span>
}

function StatusBadge({ status }: { status: ComputedStatus }) {
  const cfg = STATUS_CONFIG[status]
  return <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />
}

function CheckProgress({ done, total }: { done: number; total: number }) {
  const pct = total ? (done / total) * 100 : 0
  const color = done === total ? '#2DD4A0' : done > 0 ? '#F59E0B' : '#E2E8F0'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 5, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, fontFamily: 'Montserrat, sans-serif' }}>{done}/{total}</span>
    </div>
  )
}

type SidePanelProps = {
  lease: Lease
  checklist: Record<string, boolean>
  onClose: () => void
  onToggle: (homeId: string, key: string, current: boolean) => void
  onUpdateLease: (leaseId: string, updates: Partial<Lease>) => void
  toggling: Set<string>
}

function SidePanel({ lease, checklist, onClose, onToggle, onUpdateLease, toggling }: SidePanelProps) {
  const done = CHECKLIST_ITEMS.filter(i => checklist[i.key]).length
  const status = computeStatus(lease, done)
  const cfg = STATUS_CONFIG[status]
  const [notes, setNotes] = useState(lease.notes || '')
  const [saving, setSaving] = useState(false)
  const saveNotes = async () => {
    setSaving(true)
    await onUpdateLease(lease.lease_id, { notes })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, width: 480, height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 100, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E2E8F0', background: lease.escalated ? '#FFF5F5' : '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {lease.escalated && <span style={{ fontSize: 13 }}>🚨</span>}
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif' }}>{lease.homeowner_name}</span>
            </div>
            <a href={lease.lease_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2C4F6B', fontFamily: 'Montserrat, sans-serif', textDecoration: 'underline' }}>{lease.address}</a>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94A3B8', padding: 4 }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <StatusBadge status={status} />
          <Badge label={lease.payout_plan} color={lease.payout_plan === 'Monthly' ? '#1A3A5C' : '#64748B'} bg={lease.payout_plan === 'Monthly' ? '#EEF3F7' : '#F8FAFC'} />
          <Badge label={lease.lease_type} color='#6D28D9' bg='#F5F3FF' />
          {lease.escalated && <Badge label='🚨 Escalated' color='#DC2626' bg='#FEF2F2' />}
        </div>
      </div>

      <div style={{ padding: '16px 24px', flex: 1 }}>
        {/* Lease details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Concierge', value: lease.concierge },
            { label: 'Rent Amount', value: `$${lease.rent_amount?.toLocaleString()}` },
            { label: 'Lease Start', value: lease.lease_start_on ? new Date(lease.lease_start_on).toLocaleDateString() : '—' },
            { label: 'Lease End', value: lease.lease_end_on ? new Date(lease.lease_end_on).toLocaleDateString() : '—' },
            { label: 'Lease Status', value: lease.lease_status },
            { label: 'Agreement Status', value: lease.agreement_status },
            { label: 'Payout Status', value: lease.rent_payout_status },
            { label: 'Open Balance', value: lease.open_payable_balance > 0 ? `$${lease.open_payable_balance?.toLocaleString()}` : '$0' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, fontFamily: 'Montserrat, sans-serif', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: 13, color: '#1A3A5C', fontWeight: 600, fontFamily: 'Montserrat, sans-serif' }}>{value || '—'}</div>
            </div>
          ))}
        </div>

        {/* Open payable warning */}
        {lease.open_payable_balance > 0 && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', fontFamily: 'Montserrat, sans-serif' }}>⚠️ Open Balance: ${lease.open_payable_balance?.toLocaleString()}</div>
            {lease.first_open_payable_month && <div style={{ fontSize: 11, color: '#B91C1C', fontFamily: 'Montserrat, sans-serif', marginTop: 2 }}>{lease.first_open_payable_month}{lease.last_open_payable_month !== lease.first_open_payable_month ? ` – ${lease.last_open_payable_month}` : ''}</div>}
          </div>
        )}

        {/* Checklist */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'Montserrat, sans-serif' }}>PAYMENT SETUP CHECKLIST</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CHECKLIST_ITEMS.map(item => {
              const isDone = !!checklist[item.key]
              const key = `${lease.home_id}:${item.key}`
              const isToggling = toggling.has(key)
              return (
                <button key={item.key} onClick={() => onToggle(lease.home_id, item.key, isDone)} disabled={isToggling}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: isDone ? '#E8FBF5' : '#F8FAFC', border: `1.5px solid ${isDone ? '#2DD4A040' : '#E2E8F0'}`, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', opacity: isToggling ? 0.6 : 1, transition: 'all 0.15s' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${isDone ? '#2DD4A0' : '#CBD5E1'}`, background: isDone ? '#2DD4A0' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {isDone && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13 }}>{item.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: isDone ? '#0A6B4A' : '#1A3A5C' }}>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Manual status override */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'Montserrat, sans-serif' }}>MANUAL STATUS</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onUpdateLease(lease.lease_id, { manual_status: lease.manual_status === 'processing' ? null : 'processing' })}
              style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1.5px solid ${lease.manual_status === 'processing' ? '#22D3EE' : '#E2E8F0'}`, background: lease.manual_status === 'processing' ? '#F0FDFF' : '#F8FAFC', color: lease.manual_status === 'processing' ? '#0891B2' : '#64748B', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {lease.manual_status === 'processing' ? '✓ Processing' : 'Mark Processing'}
            </button>
            <button onClick={() => onUpdateLease(lease.lease_id, { escalated: !lease.escalated })}
              style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1.5px solid ${lease.escalated ? '#DC2626' : '#E2E8F0'}`, background: lease.escalated ? '#FEF2F2' : '#F8FAFC', color: lease.escalated ? '#DC2626' : '#64748B', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {lease.escalated ? '🚨 Escalated' : '🚨 Escalate'}
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'Montserrat, sans-serif' }}>NOTES</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add context, blockers, follow-ups…"
            style={{ width: '100%', minHeight: 90, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', fontSize: 13, resize: 'vertical', outline: 'none' }} />
          <button onClick={saveNotes} disabled={saving}
            style={{ marginTop: 8, padding: '8px 16px', borderRadius: 7, background: '#2C4F6B', color: '#fff', border: 'none', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [leases, setLeases] = useState<Lease[]>([])
  const [checklist, setChecklist] = useState<ChecklistMap>({})
  const [loading, setLoading] = useState(true)
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [liveIndicator, setLiveIndicator] = useState(false)
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterConcierge, setFilterConcierge] = useState('')
  const [filterStatus, setFilterStatus] = useState<ComputedStatus | ''>('')
  const [filterPayout, setFilterPayout] = useState('')
  const [filterLeaseType, setFilterLeaseType] = useState('')
  const [filterAgreement, setFilterAgreement] = useState('active')
  const [showPaid, setShowPaid] = useState(false)
  const [showEscalated, setShowEscalated] = useState(false)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const [sortCol, setSortCol] = useState<string>('lease_start_on')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const flashLive = useCallback(() => {
    setLiveIndicator(true)
    if (liveTimer.current) clearTimeout(liveTimer.current)
    liveTimer.current = setTimeout(() => setLiveIndicator(false), 1500)
  }, [])

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
    loadData()
    const ch = supabase.channel('live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leases' }, (p) => {
        flashLive()
        const row = p.new as Lease
        setLeases(prev => { const idx = prev.findIndex(l => l.lease_id === row.lease_id); if (idx >= 0) { const n = [...prev]; n[idx] = row; return n } return [...prev, row] })
        if (selectedLease?.lease_id === row.lease_id) setSelectedLease(row)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items' }, (p) => {
        flashLive()
        const row = p.new as any
        setChecklist(prev => ({ ...prev, [row.home_id]: { ...(prev[row.home_id] || {}), [row.item_key]: row.completed } }))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadData, flashLive, selectedLease?.lease_id])

  const handleToggle = async (homeId: string, key: string, current: boolean) => {
    const k = `${homeId}:${key}`
    if (toggling.has(k)) return
    setToggling(prev => new Set(prev).add(k))
    setChecklist(prev => ({ ...prev, [homeId]: { ...(prev[homeId] || {}), [key]: !current } }))
    await fetch('/api/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ home_id: homeId, item_key: key, completed: !current }) })
    setToggling(prev => { const s = new Set(prev); s.delete(k); return s })
  }

  const handleUpdateLease = async (leaseId: string, updates: Partial<Lease>) => {
    setLeases(prev => prev.map(l => l.lease_id === leaseId ? { ...l, ...updates } : l))
    if (selectedLease?.lease_id === leaseId) setSelectedLease(prev => prev ? { ...prev, ...updates } : prev)
    await fetch('/api/update-lease', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lease_id: leaseId, ...updates }) })
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setUploadMsg('')
    const text = await file.text()
    const res = await fetch('/api/upload-csv', { method: 'POST', body: text })
    const data = await res.json()
    if (data.error) setUploadMsg(`❌ ${data.error}`)
    else { setUploadMsg(`✅ ${data.leases} leases imported`); await loadData() }
    setUploading(false); setTimeout(() => setUploadMsg(''), 5000)
    e.target.value = ''
  }

  const toggleCol = (col: string) => setHiddenCols(prev => { const s = new Set(prev); s.has(col) ? s.delete(col) : s.add(col); return s })
  const handleSort = (col: string) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc') } }

  const allConcierges = Array.from(new Set(leases.map(l => l.concierge).filter(Boolean))).sort()

  const filtered = leases.filter(l => {
    const done = CHECKLIST_ITEMS.filter(i => checklist[l.home_id]?.[i.key]).length
    const status = computeStatus(l, done)
    if (!showPaid && status === 'paid') return false
    if (filterAgreement === 'active' && l.agreement_status?.toLowerCase() !== 'active') return false
    if (filterAgreement === 'inactive' && l.agreement_status?.toLowerCase() !== 'inactive') return false
    if (filterStatus && status !== filterStatus) return false
    if (filterPayout && l.payout_plan !== filterPayout) return false
    if (filterLeaseType && l.lease_type !== filterLeaseType) return false
    if (showEscalated && !l.escalated) return false
    if (filterConcierge) {
      const teamMembers = CONCIERGE_TEAMS[filterConcierge]
      if (teamMembers) { if (!teamMembers.includes(l.concierge)) return false }
      else if (l.concierge !== filterConcierge) return false
    }
    if (search) {
      const q = search.toLowerCase()
      if (!l.homeowner_name?.toLowerCase().includes(q) && !l.address?.toLowerCase().includes(q) && !l.concierge?.toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a, b) => {
    const aDone = CHECKLIST_ITEMS.filter(i => checklist[a.home_id]?.[i.key]).length
    const bDone = CHECKLIST_ITEMS.filter(i => checklist[b.home_id]?.[i.key]).length
    const aStatus = computeStatus(a, aDone); const bStatus = computeStatus(b, bDone)
    // Escalated always first
    if (a.escalated && !b.escalated) return -1
    if (!a.escalated && b.escalated) return 1
    let av: any, bv: any
    if (sortCol === 'status') { av = STATUS_CONFIG[aStatus].priority; bv = STATUS_CONFIG[bStatus].priority }
    else if (sortCol === 'lease_start_on') { av = a.lease_start_on ? new Date(a.lease_start_on).getTime() : 0; bv = b.lease_start_on ? new Date(b.lease_start_on).getTime() : 0 }
    else if (sortCol === 'rent_amount') { av = a.rent_amount; bv = b.rent_amount }
    else if (sortCol === 'open_payable_balance') { av = a.open_payable_balance; bv = b.open_payable_balance }
    else if (sortCol === 'checklist') { av = aDone; bv = bDone }
    else { av = (a as any)[sortCol] || ''; bv = (b as any)[sortCol] || '' }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const cols = [
    { key: 'address', label: 'Address', frozen: true },
    { key: 'concierge', label: 'Concierge', frozen: true },
    { key: 'homeowner_name', label: 'Homeowner' },
    { key: 'lease_start_on', label: 'Lease Start' },
    { key: 'rent_amount', label: 'Rent' },
    { key: 'payout_plan', label: 'Payout Plan' },
    { key: 'lease_type', label: 'Lease Type' },
    { key: 'open_payable_balance', label: 'Open Balance' },
    { key: 'status', label: 'Status' },
    { key: 'checklist', label: 'Setup' },
  ]

  const stats = {
    failed: leases.filter(l => computeStatus(l, CHECKLIST_ITEMS.filter(i => checklist[l.home_id]?.[i.key]).length) === 'failed').length,
    readyToProcess: leases.filter(l => computeStatus(l, CHECKLIST_ITEMS.filter(i => checklist[l.home_id]?.[i.key]).length) === 'ready_to_process').length,
    pending: leases.filter(l => computeStatus(l, CHECKLIST_ITEMS.filter(i => checklist[l.home_id]?.[i.key]).length) === 'pending').length,
    escalated: leases.filter(l => l.escalated).length,
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16, background: '#F5F7FA' }}>
      <div style={{ fontSize: 32, fontWeight: 700, color: '#2C4F6B', fontFamily: 'Montserrat, sans-serif' }}>belong</div>
      <div style={{ width: 28, height: 28, border: '3px solid #E2E8F0', borderTop: '3px solid #2DD4A0', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#2C4F6B', padding: '0', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 2px 12px rgba(44,79,107,0.18)' }}>
        <div style={{ maxWidth: '100%', padding: '13px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>belong<span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#2DD4A0', marginLeft: 2, verticalAlign: 'middle' }} /></div>
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Homeowner Payouts</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Payment Readiness Tracker</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {uploadMsg && <span style={{ fontSize: 12, color: '#2DD4A0', fontWeight: 600 }}>{uploadMsg}</span>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, background: liveIndicator ? 'rgba(45,212,160,0.2)' : 'rgba(255,255,255,0.1)', border: `1px solid ${liveIndicator ? '#2DD4A0' : 'rgba(255,255,255,0.15)'}`, transition: 'all 0.3s' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: liveIndicator ? '#2DD4A0' : 'rgba(255,255,255,0.4)', boxShadow: liveIndicator ? '0 0 8px #2DD4A0' : 'none', transition: 'all 0.3s' }} />
              <span style={{ fontSize: 11, color: liveIndicator ? '#2DD4A0' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}>LIVE</span>
            </div>
            <label style={{ padding: '8px 14px', borderRadius: 8, background: uploading ? 'rgba(255,255,255,0.1)' : '#2DD4A0', color: uploading ? 'rgba(255,255,255,0.5)' : '#1A3A5C', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}>
              {uploading ? '⏳ Importing…' : '⬆ Upload CSV'}
              <input type="file" accept=".csv" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>
          </div>
        </div>
      </header>

      <div style={{ padding: '20px 24px' }}>
        {/* Alert stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Failed', value: stats.failed, color: '#DC2626', bg: '#FEF2F2', f: 'failed' as ComputedStatus },
            { label: 'Ready to Process', value: stats.readyToProcess, color: '#0891B2', bg: '#ECFEFF', f: 'ready_to_process' as ComputedStatus },
            { label: 'Pending Setup', value: stats.pending, color: '#F59E0B', bg: '#FFFBEB', f: 'pending' as ComputedStatus },
            { label: '🚨 Escalated', value: stats.escalated, color: '#DC2626', bg: '#FEF2F2', f: null },
          ].map(s => (
            <button key={s.label} onClick={() => { if (s.f) setFilterStatus(filterStatus === s.f ? '' : s.f); else setShowEscalated(!showEscalated) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 10, background: '#fff', border: `1.5px solid ${(s.f ? filterStatus === s.f : showEscalated) ? s.color : '#E2E8F0'}`, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: 'Montserrat, sans-serif' }}>{s.value}</span>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{s.label}</span>
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#64748B', fontWeight: 600 }}>
              <input type="checkbox" checked={showPaid} onChange={e => setShowPaid(e.target.checked)} />Show Paid
            </label>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center', background: '#fff', padding: '14px 16px', borderRadius: 10, border: '1px solid #E2E8F0' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name, address, concierge…"
            style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', fontSize: 12, outline: 'none' }} />
          <select value={filterConcierge} onChange={e => setFilterConcierge(e.target.value)} style={selectStyle}>
            <option value="">All Concierges</option>
            {Object.keys(CONCIERGE_TEAMS).map(t => <option key={t} value={t}>{t}</option>)}
            <optgroup label="Individual">
              {allConcierges.map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ComputedStatus | '')} style={selectStyle}>
            <option value="">All Statuses</option>
            <option value="failed">Failed</option>
            <option value="ready_to_process">Ready to Process</option>
            <option value="processing">Processing</option>
            <option value="ready_to_pay">Ready to Pay</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
          <select value={filterPayout} onChange={e => setFilterPayout(e.target.value)} style={selectStyle}>
            <option value="">All Payout Plans</option>
            <option value="Monthly">Monthly (Guaranteed)</option>
            <option value="NoGuarantee">No Guarantee</option>
          </select>
          <select value={filterLeaseType} onChange={e => setFilterLeaseType(e.target.value)} style={selectStyle}>
            <option value="">All Lease Types</option>
            {['New', 'Renewal', 'Turnover', 'Adopted', 'Revised', 'Canceled'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterAgreement} onChange={e => setFilterAgreement(e.target.value)} style={selectStyle}>
            <option value="active">Active Agreements</option>
            <option value="inactive">Inactive Agreements</option>
            <option value="">All Agreements</option>
          </select>
          <button onClick={() => { setSearch(''); setFilterConcierge(''); setFilterStatus(''); setFilterPayout(''); setFilterLeaseType(''); setFilterAgreement('active'); setShowEscalated(false) }}
            style={{ padding: '8px 12px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#94A3B8', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Clear</button>
        </div>

        {/* Column visibility */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>COLUMNS:</span>
          {cols.filter(c => !c.frozen).map(c => (
            <button key={c.key} onClick={() => toggleCol(c.key)}
              style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: `1px solid ${hiddenCols.has(c.key) ? '#E2E8F0' : '#2C4F6B'}`, background: hiddenCols.has(c.key) ? '#F8FAFC' : '#EEF3F7', color: hiddenCols.has(c.key) ? '#94A3B8' : '#2C4F6B', cursor: 'pointer' }}>
              {hiddenCols.has(c.key) ? '○' : '●'} {c.label}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>{filtered.length} leases</span>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'Montserrat, sans-serif' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                  {cols.filter(c => !hiddenCols.has(c.key)).map(c => (
                    <th key={c.key} onClick={() => handleSort(c.key)}
                      style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', position: c.frozen ? 'sticky' : 'static', left: c.key === 'address' ? 0 : c.key === 'concierge' ? 220 : 'auto', background: '#F8FAFC', zIndex: c.frozen ? 2 : 'auto' }}>
                      {c.label.toUpperCase()} {sortCol === c.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={cols.length} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>No leases match your filters</td></tr>
                ) : filtered.map((lease, idx) => {
                  const done = CHECKLIST_ITEMS.filter(i => checklist[lease.home_id]?.[i.key]).length
                  const status = computeStatus(lease, done)
                  const cfg = STATUS_CONFIG[status]
                  const isSelected = selectedLease?.lease_id === lease.lease_id
                  return (
                    <tr key={lease.lease_id} onClick={() => setSelectedLease(isSelected ? null : lease)}
                      style={{ borderBottom: '1px solid #F0F4F8', background: lease.escalated ? '#FFF5F5' : isSelected ? '#F0F4FF' : idx % 2 === 0 ? '#fff' : '#FAFBFC', cursor: 'pointer', transition: 'background 0.15s' }}>
                      {!hiddenCols.has('address') && (
                        <td style={{ padding: '11px 14px', position: 'sticky', left: 0, background: lease.escalated ? '#FFF5F5' : isSelected ? '#F0F4FF' : idx % 2 === 0 ? '#fff' : '#FAFBFC', zIndex: 1, maxWidth: 220, minWidth: 180 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {lease.escalated && <span style={{ fontSize: 12 }}>🚨</span>}
                            <a href={`https://foundation.bln.hm/homes/${lease.home_id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                              style={{ color: '#2C4F6B', fontWeight: 600, fontSize: 12, textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 200 }}>{lease.address}</a>
                          </div>
                        </td>
                      )}
                      {!hiddenCols.has('concierge') && <td style={{ padding: '11px 14px', position: 'sticky', left: hiddenCols.has('address') ? 0 : 220, background: lease.escalated ? '#FFF5F5' : isSelected ? '#F0F4FF' : idx % 2 === 0 ? '#fff' : '#FAFBFC', zIndex: 1, whiteSpace: 'nowrap', color: '#1A3A5C', fontWeight: 500 }}>{lease.concierge}</td>}
                      {!hiddenCols.has('homeowner_name') && <td style={{ padding: '11px 14px', color: '#1A3A5C', fontWeight: 600, whiteSpace: 'nowrap' }}>{lease.homeowner_name}</td>}
                      {!hiddenCols.has('lease_start_on') && (
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          {lease.lease_start_on ? (
                            <a href={lease.lease_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                              style={{ color: '#2C4F6B', textDecoration: 'underline', fontWeight: 600 }}>
                              {new Date(lease.lease_start_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </a>
                          ) : '—'}
                        </td>
                      )}
                      {!hiddenCols.has('rent_amount') && <td style={{ padding: '11px 14px', color: '#1A3A5C', fontWeight: 600, whiteSpace: 'nowrap' }}>${lease.rent_amount?.toLocaleString()}</td>}
                      {!hiddenCols.has('payout_plan') && <td style={{ padding: '11px 14px' }}><Badge label={lease.payout_plan === 'Monthly' ? '● Guaranteed' : '○ No Guarantee'} color={lease.payout_plan === 'Monthly' ? '#1A3A5C' : '#94A3B8'} bg={lease.payout_plan === 'Monthly' ? '#EEF3F7' : '#F8FAFC'} /></td>}
                      {!hiddenCols.has('lease_type') && <td style={{ padding: '11px 14px' }}><Badge label={lease.lease_type} color='#6D28D9' bg='#F5F3FF' /></td>}
                      {!hiddenCols.has('open_payable_balance') && <td style={{ padding: '11px 14px', color: lease.open_payable_balance > 0 ? '#DC2626' : '#94A3B8', fontWeight: lease.open_payable_balance > 0 ? 700 : 400 }}>{lease.open_payable_balance > 0 ? `$${lease.open_payable_balance?.toLocaleString()}` : '—'}</td>}
                      {!hiddenCols.has('status') && <td style={{ padding: '11px 14px' }}><StatusBadge status={status} /></td>}
                      {!hiddenCols.has('checklist') && <td style={{ padding: '11px 14px' }}><CheckProgress done={done} total={CHECKLIST_ITEMS.length} /></td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 20, textAlign: 'center', color: '#CBD5E1', fontSize: 11 }}>belong · Homeowner Payouts Dashboard · Internal Use Only</div>
      </div>

      {/* Side panel overlay */}
      {selectedLease && (
        <>
          <div onClick={() => setSelectedLease(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 99 }} />
          <SidePanel lease={selectedLease} checklist={checklist[selectedLease.home_id] || {}} onClose={() => setSelectedLease(null)} onToggle={handleToggle} onUpdateLease={handleUpdateLease} toggling={toggling} />
        </>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#F8FAFC',
  color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', fontSize: 12, outline: 'none', cursor: 'pointer',
}
