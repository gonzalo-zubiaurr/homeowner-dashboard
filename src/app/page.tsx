'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, CHECKLIST_ITEMS, computeStatus, STATUS_CONFIG, type Lease, type ChecklistMap, type ComputedStatus } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

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

// Multi-select dropdown component
function MultiSelect({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ ...selectStyle, display: 'flex', alignItems: 'center', gap: 6, minWidth: 150 }}>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected.length === 0 ? label : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
        <span style={{ fontSize: 10, color: '#94A3B8' }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 200, maxHeight: 260, overflowY: 'auto', marginTop: 4 }}>
          {selected.length > 0 && (
            <button onClick={() => onChange([])} style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid #F0F4F8', cursor: 'pointer', fontSize: 11, color: '#DC2626', fontWeight: 700, textAlign: 'left', fontFamily: 'Montserrat, sans-serif' }}>Clear all</button>
          )}
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

// Date filter component
function DateFilter({ filterMonth, filterRange, onMonthChange, onRangeChange }: {
  filterMonth: string; filterRange: { from: string; to: string };
  onMonthChange: (v: string) => void; onRangeChange: (v: { from: string; to: string }) => void
}) {
  const [mode, setMode] = useState<'month' | 'range'>('month')
  const months = ['Jan 2026','Feb 2026','Mar 2026','Apr 2026','May 2026','Jun 2026','Jul 2026','Aug 2026','Sep 2026','Oct 2026','Nov 2026','Dec 2026',
                  'Jan 2027','Feb 2027','Mar 2027','Apr 2027','May 2027','Jun 2027']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', borderRadius: 6, border: '1.5px solid #E2E8F0', overflow: 'hidden' }}>
        {(['month', 'range'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); onMonthChange(''); onRangeChange({ from: '', to: '' }) }}
            style={{ padding: '6px 10px', border: 'none', background: mode === m ? '#2C4F6B' : '#F8FAFC', color: mode === m ? '#fff' : '#64748B', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'Montserrat, sans-serif' }}>
            {m === 'month' ? 'Month' : 'Range'}
          </button>
        ))}
      </div>
      {mode === 'month' ? (
        <select value={filterMonth} onChange={e => onMonthChange(e.target.value)} style={selectStyle}>
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="date" value={filterRange.from} onChange={e => onRangeChange({ ...filterRange, from: e.target.value })} style={{ ...selectStyle, width: 130 }} />
          <span style={{ fontSize: 11, color: '#94A3B8' }}>→</span>
          <input type="date" value={filterRange.to} onChange={e => onRangeChange({ ...filterRange, to: e.target.value })} style={{ ...selectStyle, width: 130 }} />
        </div>
      )}
    </div>
  )
}

type SidePanelProps = {
  lease: Lease; checklist: Record<string, boolean>; onClose: () => void
  onToggle: (homeId: string, key: string, current: boolean) => void
  onUpdateLease: (leaseId: string, updates: Partial<Lease>) => void; toggling: Set<string>
}

function SidePanel({ lease, checklist, onClose, onToggle, onUpdateLease, toggling }: SidePanelProps) {
  const done = CHECKLIST_ITEMS.filter(i => checklist[i.key]).length
  const status = computeStatus(lease, done)
  const [notes, setNotes] = useState(lease.notes || '')
  const [intercomLink, setIntercomLink] = useState(lease.intercom_link || '')
  const [savingIntercom, setSavingIntercom] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveNotes = async () => { setSaving(true); await onUpdateLease(lease.lease_id, { notes }); setSaving(false) }
  const saveIntercom = async () => { setSavingIntercom(true); await onUpdateLease(lease.lease_id, { intercom_link: intercomLink }); setSavingIntercom(false) }
  const [escalationSlackLink, setEscalationSlackLink] = useState(lease.escalation_slack_link || '')
  const [savingSlack, setSavingSlack] = useState(false)
  const saveSlack = async () => { setSavingSlack(true); await onUpdateLease(lease.lease_id, { escalation_slack_link: escalationSlackLink }); setSavingSlack(false) }

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, width: 480, height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 100, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E2E8F0', background: lease.escalated ? '#FFF5F5' : '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {lease.escalated && <span style={{ fontSize: 13 }}>🚨</span>}
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif' }}>{lease.homeowner_name}</span>
            </div>
            <a href={`https://foundation.bln.hm/homes/${lease.home_id}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2C4F6B', fontFamily: 'Montserrat, sans-serif', textDecoration: 'underline' }}>{lease.address}</a>
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

        {/* Failed months detail */}
        {lease.open_payable_balance > 0 && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', fontFamily: 'Montserrat, sans-serif', marginBottom: 6 }}>
              ⚠️ {lease.open_payable_count} Failed Month{lease.open_payable_count !== 1 ? 's' : ''} — ${lease.open_payable_balance?.toLocaleString()} outstanding
            </div>
            {lease.first_open_payable_month && (
              <div style={{ fontSize: 11, color: '#B91C1C', fontFamily: 'Montserrat, sans-serif', marginBottom: 8 }}>
                Period: {lease.first_open_payable_month}{lease.last_open_payable_month && lease.last_open_payable_month !== lease.first_open_payable_month ? ` → ${lease.last_open_payable_month}` : ''}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {lease.first_open_payable_balance_link && (
                <a href={lease.first_open_payable_balance_link} target="_blank" rel="noreferrer"
                  style={{ padding: '6px 12px', borderRadius: 6, background: '#fff', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: 'Montserrat, sans-serif' }}>
                  First Balance ↗
                </a>
              )}
              {lease.last_open_payable_balance_link && lease.last_open_payable_balance_link !== lease.first_open_payable_balance_link && (
                <a href={lease.last_open_payable_balance_link} target="_blank" rel="noreferrer"
                  style={{ padding: '6px 12px', borderRadius: 6, background: '#fff', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: 'Montserrat, sans-serif' }}>
                  Last Balance ↗
                </a>
              )}
            </div>
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
                  <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${isDone ? '#2DD4A0' : '#CBD5E1'}`, background: isDone ? '#2DD4A0' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isDone && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13 }}>{item.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: isDone ? '#0A6B4A' : '#1A3A5C' }}>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Manual status */}
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
          {lease.escalated && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, fontFamily: 'Montserrat, sans-serif', marginBottom: 6, letterSpacing: '0.05em' }}>SLACK ESCALATION THREAD</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={escalationSlackLink} onChange={e => setEscalationSlackLink(e.target.value)} placeholder="Paste Slack thread link…"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #FCA5A5', background: '#FFF5F5', color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', fontSize: 12, outline: 'none' }} />
                {escalationSlackLink && <a href={escalationSlackLink} target="_blank" rel="noreferrer" style={{ padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' as const }}>Open ↗</a>}
              </div>
              <button onClick={saveSlack} disabled={savingSlack}
                style={{ marginTop: 6, padding: '7px 14px', borderRadius: 7, background: '#DC2626', color: '#fff', border: 'none', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: savingSlack ? 'wait' : 'pointer', opacity: savingSlack ? 0.7 : 1 }}>
                {savingSlack ? 'Saving…' : 'Save Slack Link'}
              </button>
            </div>
          )}
        </div>

        {/* Intercom Link */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'Montserrat, sans-serif' }}>INTERCOM CONVERSATION</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={intercomLink} onChange={e => setIntercomLink(e.target.value)} placeholder="Paste Intercom conversation link…"
              style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', fontSize: 12, outline: 'none' }} />
            {intercomLink && <a href={intercomLink} target="_blank" rel="noreferrer" style={{ padding: '9px 12px', borderRadius: 8, background: '#EEF3F7', color: '#2C4F6B', fontWeight: 700, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' as const }}>Open ↗</a>}
          </div>
          <button onClick={saveIntercom} disabled={savingIntercom}
            style={{ marginTop: 8, padding: '8px 16px', borderRadius: 7, background: '#2C4F6B', color: '#fff', border: 'none', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: savingIntercom ? 'wait' : 'pointer', opacity: savingIntercom ? 0.7 : 1 }}>
            {savingIntercom ? 'Saving…' : 'Save Link'}
          </button>
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
  const [user, setUser] = useState<User | null>(null)
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterConcierges, setFilterConcierges] = useState<string[]>([])
  const [filterStatus, setFilterStatus] = useState<ComputedStatus | ''>('')
  const [filterPayouts, setFilterPayouts] = useState<string[]>(['Monthly'])
  const [filterLeaseTypes, setFilterLeaseTypes] = useState<string[]>(['New'])
  const [filterAgreement, setFilterAgreement] = useState('active')
  const [showPaid, setShowPaid] = useState(false)
  const [showEscalated, setShowEscalated] = useState(false)
  const [filterMonth, setFilterMonth] = useState('')
  const [filterRange, setFilterRange] = useState({ from: '', to: '' })
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const [sortCol, setSortCol] = useState('lease_start_on')
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
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.replace('/login')
        return
      }
      setUser(data.user)
    })
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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const toggleCol = (col: string) => setHiddenCols(prev => { const s = new Set(prev); s.has(col) ? s.delete(col) : s.add(col); return s })
  const handleSort = (col: string) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc') } }

  const allConcierges = Array.from(new Set(leases.map(l => l.concierge).filter(Boolean))).sort()
  const allLeaseTypes = Array.from(new Set(leases.map(l => l.lease_type).filter(Boolean))).sort()

  const matchesDate = (lease: Lease) => {
    const d = lease.lease_start_on ? new Date(lease.lease_start_on) : null
    if (!d) return !filterMonth && !filterRange.from
    if (filterMonth) {
      const [mon, yr] = filterMonth.split(' ')
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      return d.getMonth() === months.indexOf(mon) && d.getFullYear() === parseInt(yr)
    }
    if (filterRange.from || filterRange.to) {
      const from = filterRange.from ? new Date(filterRange.from) : null
      const to = filterRange.to ? new Date(filterRange.to) : null
      if (from && d < from) return false
      if (to && d > to) return false
    }
    return true
  }

  const filtered = leases.filter(l => {
    const done = CHECKLIST_ITEMS.filter(i => checklist[l.home_id]?.[i.key]).length
    const status = computeStatus(l, done)
    if (!showPaid && status === 'paid') return false
    if (filterAgreement === 'active' && l.agreement_status?.toLowerCase() !== 'active') return false
    if (filterAgreement === 'inactive' && l.agreement_status?.toLowerCase() !== 'inactive') return false
    if (filterStatus && status !== filterStatus) return false
    if (filterPayouts.length > 0 && !filterPayouts.includes(l.payout_plan)) return false
    if (filterLeaseTypes.length > 0 && !filterLeaseTypes.includes(l.lease_type)) return false
    if (filterConcierges.length > 0 && !filterConcierges.includes(l.concierge)) return false
    if (showEscalated && !l.escalated) return false
    if (!matchesDate(l)) return false
    if (search) {
      const q = search.toLowerCase()
      if (!l.homeowner_name?.toLowerCase().includes(q) && !l.address?.toLowerCase().includes(q) && !l.concierge?.toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a, b) => {
    const aDone = CHECKLIST_ITEMS.filter(i => checklist[a.home_id]?.[i.key]).length
    const bDone = CHECKLIST_ITEMS.filter(i => checklist[b.home_id]?.[i.key]).length
    const aStatus = computeStatus(a, aDone); const bStatus = computeStatus(b, bDone)
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
    { key: 'status', label: 'Status' },
    { key: 'checklist', label: 'Setup' },
    { key: 'lease_start_on', label: 'Lease Start' },
    { key: 'rent_amount', label: 'Rent' },
    { key: 'payout_plan', label: 'Payout Plan' },
    { key: 'lease_type', label: 'Lease Type' },
    { key: 'failed_months', label: 'Open Months' },
    { key: 'open_payable_balance', label: 'Open Balance' },
  ]

  const stats = {
    failed: filtered.filter(l => computeStatus(l, CHECKLIST_ITEMS.filter(i => checklist[l.home_id]?.[i.key]).length) === 'failed').length,
    readyToProcess: filtered.filter(l => computeStatus(l, CHECKLIST_ITEMS.filter(i => checklist[l.home_id]?.[i.key]).length) === 'ready_to_process').length,
    pending: filtered.filter(l => computeStatus(l, CHECKLIST_ITEMS.filter(i => checklist[l.home_id]?.[i.key]).length) === 'pending').length,
    escalated: filtered.filter(l => l.escalated).length,
  }

  const clearFilters = () => {
    setSearch(''); setFilterConcierges([]); setFilterStatus(''); setFilterPayouts([])
    setFilterLeaseTypes([]); setFilterAgreement('active'); setShowEscalated(false)
    setFilterMonth(''); setFilterRange({ from: '', to: '' })
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
      <header style={{ background: '#2C4F6B', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 2px 12px rgba(44,79,107,0.18)' }}>
        <div style={{ padding: '13px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontFamily: 'Montserrat, sans-serif', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</span>
              <button onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, padding: 0 }}>Sign out</button>
            </div>
          </div>
        </div>
      </header>

      <div style={{ padding: '20px 24px' }}>
        {/* Alert stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: 'Failed', value: stats.failed, color: '#DC2626', bg: '#FEF2F2', f: 'failed' as ComputedStatus },
            { label: 'Ready to Process', value: stats.readyToProcess, color: '#0891B2', bg: '#ECFEFF', f: 'ready_to_process' as ComputedStatus },
            { label: 'Pending Setup', value: stats.pending, color: '#F59E0B', bg: '#FFFBEB', f: 'pending' as ComputedStatus },
            { label: '🚨 Escalated', value: stats.escalated, color: '#DC2626', bg: '#FEF2F2', f: null },
          ].map(s => (
            <button key={s.label} onClick={() => { if (s.f) setFilterStatus(filterStatus === s.f ? '' : s.f); else setShowEscalated(!showEscalated) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 10, background: '#fff', border: `1.5px solid ${(s.f ? filterStatus === s.f : showEscalated) ? s.color : '#E2E8F0'}`, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: 'Montserrat, sans-serif' }}>{s.value}</span>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, fontFamily: 'Montserrat, sans-serif' }}>{s.label}</span>
            </button>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#64748B', fontWeight: 600, marginLeft: 'auto' }}>
            <input type="checkbox" checked={showPaid} onChange={e => setShowPaid(e.target.checked)} style={{ accentColor: '#2C4F6B' }} />Show Paid
          </label>
        </div>

        {/* Filters */}
        <div style={{ background: '#fff', padding: '14px 16px', borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name, address, concierge…"
              style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', fontSize: 12, outline: 'none' }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ComputedStatus | '')} style={selectStyle}>
              <option value="">All Statuses</option>
              <option value="failed">Failed</option>
              <option value="ready_to_process">Ready to Process</option>
              <option value="processing">Processing</option>
              <option value="ready_to_pay">Ready to Pay</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
            <select value={filterAgreement} onChange={e => setFilterAgreement(e.target.value)} style={selectStyle}>
              <option value="active">Active Agreements</option>
              <option value="inactive">Inactive Agreements</option>
              <option value="">All Agreements</option>
            </select>
            <button onClick={clearFilters} style={{ padding: '8px 12px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#94A3B8', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Clear All</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <MultiSelect label="All Concierges" options={allConcierges} selected={filterConcierges} onChange={setFilterConcierges} />
            <MultiSelect label="All Payout Plans" options={['Monthly', 'NoGuarantee']} selected={filterPayouts} onChange={setFilterPayouts} />
            <MultiSelect label="All Lease Types" options={allLeaseTypes} selected={filterLeaseTypes} onChange={setFilterLeaseTypes} />
            <DateFilter filterMonth={filterMonth} filterRange={filterRange} onMonthChange={setFilterMonth} onRangeChange={setFilterRange} />
          </div>
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
                      style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', position: c.frozen ? 'sticky' as const : 'static' as const, left: c.key === 'address' ? 0 : c.key === 'concierge' ? 220 : 'auto', background: '#F8FAFC', zIndex: c.frozen ? 2 : 'auto' }}>
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
                  const isSelected = selectedLease?.lease_id === lease.lease_id
                  const rowBg = lease.escalated ? '#FFF5F5' : isSelected ? '#F0F4FF' : idx % 2 === 0 ? '#fff' : '#FAFBFC'
                  return (
                    <tr key={lease.lease_id} onClick={() => setSelectedLease(isSelected ? null : lease)}
                      style={{ borderBottom: '1px solid #F0F4F8', background: rowBg, cursor: 'pointer', transition: 'background 0.15s' }}>
                      {!hiddenCols.has('address') && (
                        <td style={{ padding: '11px 14px', position: 'sticky', left: 0, background: rowBg, zIndex: 1, maxWidth: 220, minWidth: 180 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {lease.escalated && (lease.escalation_slack_link ? <a href={lease.escalation_slack_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, textDecoration: 'none' }}>🚨</a> : <span style={{ fontSize: 12 }}>🚨</span>)}
                            <a href={`https://foundation.bln.hm/homes/${lease.home_id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                              style={{ color: '#2C4F6B', fontWeight: 600, fontSize: 12, textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 200 }}>{lease.address}</a>
                          </div>
                        </td>
                      )}
                      {!hiddenCols.has('concierge') && <td style={{ padding: '11px 14px', position: 'sticky', left: hiddenCols.has('address') ? 0 : 220, background: rowBg, zIndex: 1, whiteSpace: 'nowrap', color: '#1A3A5C', fontWeight: 500 }}>{lease.concierge}</td>}
                      {!hiddenCols.has('homeowner_name') && <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>{lease.homeowner_link ? <a href={lease.homeowner_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#2C4F6B', fontWeight: 600, textDecoration: 'underline' }}>{lease.homeowner_name}</a> : <span style={{ color: '#1A3A5C', fontWeight: 600 }}>{lease.homeowner_name}</span>}</td>}
                      {!hiddenCols.has('status') && <td style={{ padding: '11px 14px' }}><StatusBadge status={status} /></td>}
                      {!hiddenCols.has('checklist') && <td style={{ padding: '11px 14px' }}><CheckProgress done={done} total={CHECKLIST_ITEMS.length} /></td>}
                      {!hiddenCols.has('lease_start_on') && (
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          {lease.lease_start_on
                            ? <a href={lease.lease_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#2C4F6B', textDecoration: 'underline', fontWeight: 600 }}>{new Date(lease.lease_start_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</a>
                            : '—'}
                        </td>
                      )}
                      {!hiddenCols.has('rent_amount') && <td style={{ padding: '11px 14px', color: '#1A3A5C', fontWeight: 600, whiteSpace: 'nowrap' }}>${lease.rent_amount?.toLocaleString()}</td>}
                      {!hiddenCols.has('payout_plan') && <td style={{ padding: '11px 14px' }}><Badge label={lease.payout_plan === 'Monthly' ? '● Guaranteed' : '○ No Guarantee'} color={lease.payout_plan === 'Monthly' ? '#1A3A5C' : '#94A3B8'} bg={lease.payout_plan === 'Monthly' ? '#EEF3F7' : '#F8FAFC'} /></td>}
                      {!hiddenCols.has('lease_type') && <td style={{ padding: '11px 14px' }}><Badge label={lease.lease_type} color='#6D28D9' bg='#F5F3FF' /></td>}
                      {!hiddenCols.has('failed_months') && (
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          {lease.open_payable_count > 0
                            ? <span style={{ color: '#DC2626', fontWeight: 700 }}>{lease.open_payable_count} mo{lease.first_open_payable_month ? ` (${lease.first_open_payable_month}${lease.last_open_payable_month && lease.last_open_payable_month !== lease.first_open_payable_month ? `→${lease.last_open_payable_month}` : ''})` : ''}</span>
                            : <span style={{ color: '#94A3B8' }}>—</span>}
                        </td>
                      )}
                      {!hiddenCols.has('open_payable_balance') && <td style={{ padding: '11px 14px', color: lease.open_payable_balance > 0 ? '#DC2626' : '#94A3B8', fontWeight: lease.open_payable_balance > 0 ? 700 : 400 }}>{lease.open_payable_balance > 0 ? `$${lease.open_payable_balance?.toLocaleString()}` : '—'}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ marginTop: 20, textAlign: 'center', color: '#CBD5E1', fontSize: 11 }}>belong · Homeowner Payouts Dashboard · Internal Use Only</div>
      </div>

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
