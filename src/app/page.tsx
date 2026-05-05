'use client'
import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, CHECKLIST_ITEMS, computeStatus, STATUS_CONFIG, type Lease, type LeaseNote, type ChecklistMap, type ComputedStatus } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const DEFAULT_LEASE_TYPES = ['New', 'Adopted', 'Revised', 'Turnover']

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${color}30`, whiteSpace: 'nowrap' as const, fontFamily: 'Montserrat, sans-serif' }}>{label}</span>
}

function StatusBadge({ status }: { status: ComputedStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span title={cfg.tooltip} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, whiteSpace: 'nowrap' as const, fontFamily: 'Montserrat, sans-serif', fontStyle: cfg.italic ? 'italic' : 'normal', cursor: 'help' }}>
      {cfg.label}{cfg.italic ? ' (future)' : ''}
    </span>
  )
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
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {selected.length === 0 ? label : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
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

type SidePanelProps = {
  lease: Lease; checklist: Record<string, boolean>; notes: LeaseNote[]
  onClose: () => void; onToggle: (homeId: string, key: string, current: boolean) => void
  onUpdateLease: (leaseId: string, updates: Partial<Lease>) => void
  onAddNote: (leaseId: string, note: string) => void
  toggling: Set<string>; currentUser: User | null
}

function SidePanel({ lease, checklist, notes, onClose, onToggle, onUpdateLease, onAddNote, toggling, currentUser }: SidePanelProps) {
  const done = CHECKLIST_ITEMS.filter(i => checklist[i.key]).length
  const status = computeStatus(lease, done)
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [intercomLink, setIntercomLink] = useState(lease.intercom_link || '')
  const [savingIntercom, setSavingIntercom] = useState(false)
  const [escalationSlackLink, setEscalationSlackLink] = useState(lease.escalation_slack_link || '')
  const [savingSlack, setSavingSlack] = useState(false)

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setSavingNote(true)
    await onAddNote(lease.lease_id, newNote.trim())
    setNewNote('')
    setSavingNote(false)
  }

  const saveIntercom = async () => { setSavingIntercom(true); await onUpdateLease(lease.lease_id, { intercom_link: intercomLink }); setSavingIntercom(false) }
  const saveSlack = async () => { setSavingSlack(true); await onUpdateLease(lease.lease_id, { escalation_slack_link: escalationSlackLink }); setSavingSlack(false) }

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, width: 500, height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 100, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E2E8F0', background: lease.escalated ? '#FFF5F5' : '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {lease.escalated && (lease.escalation_slack_link ? <a href={lease.escalation_slack_link} target="_blank" rel="noreferrer" style={{ fontSize: 14, textDecoration: 'none' }}>🚨</a> : <span style={{ fontSize: 14 }}>🚨</span>)}
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif' }}>
                {lease.homeowner_link ? <a href={lease.homeowner_link} target="_blank" rel="noreferrer" style={{ color: '#2C4F6B', textDecoration: 'underline' }}>{lease.homeowner_name}</a> : lease.homeowner_name}
              </span>
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

      <div style={{ padding: '16px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Concierge', value: lease.concierge },
            { label: 'Rent Amount', value: `$${lease.rent_amount?.toLocaleString()}` },
            { label: 'Lease Start', value: lease.lease_start_on ? new Date(lease.lease_start_on).toLocaleDateString() : '—' },
            { label: 'Lease End', value: lease.lease_end_on ? new Date(lease.lease_end_on).toLocaleDateString() : '—' },
            { label: 'Lease Status', value: lease.lease_status },
            { label: 'Agreement', value: lease.agreement_status },
            { label: 'Payout Status', value: lease.rent_payout_status },
            { label: 'Open Balance', value: lease.open_payable_balance > 0 ? `$${lease.open_payable_balance?.toLocaleString()}` : '$0' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, fontFamily: 'Montserrat, sans-serif', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: 13, color: '#1A3A5C', fontWeight: 600, fontFamily: 'Montserrat, sans-serif' }}>{value || '—'}</div>
            </div>
          ))}
        </div>

        {/* Open balance warning */}
        {lease.open_payable_balance > 0 && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', fontFamily: 'Montserrat, sans-serif', marginBottom: 6 }}>
              ⚠️ {lease.open_payable_count} Failed Month{lease.open_payable_count !== 1 ? 's' : ''} — ${lease.open_payable_balance?.toLocaleString()} outstanding
            </div>
            {lease.first_open_payable_month && (
              <div style={{ fontSize: 11, color: '#B91C1C', fontFamily: 'Montserrat, sans-serif', marginBottom: 8 }}>
                Period: {lease.first_open_payable_month}{lease.last_open_payable_month && lease.last_open_payable_month !== lease.first_open_payable_month ? ` → ${lease.last_open_payable_month}` : ''}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {lease.first_open_payable_balance_link && <a href={lease.first_open_payable_balance_link} target="_blank" rel="noreferrer" style={{ padding: '5px 10px', borderRadius: 6, background: '#fff', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: 'Montserrat, sans-serif' }}>First Balance ↗</a>}
              {lease.last_open_payable_balance_link && lease.last_open_payable_balance_link !== lease.first_open_payable_balance_link && <a href={lease.last_open_payable_balance_link} target="_blank" rel="noreferrer" style={{ padding: '5px 10px', borderRadius: 6, background: '#fff', border: '1px solid #FCA5A5', color: '#DC2626', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: 'Montserrat, sans-serif' }}>Last Balance ↗</a>}
            </div>
          </div>
        )}

        {/* Checklist */}
        <div>
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
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'Montserrat, sans-serif' }}>MANUAL STATUS</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onUpdateLease(lease.lease_id, { manual_status: lease.manual_status === 'processing' ? null : 'processing' })}
              style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1.5px solid ${lease.manual_status === 'processing' ? '#06B6D4' : '#E2E8F0'}`, background: lease.manual_status === 'processing' ? '#ECFEFF' : '#F8FAFC', color: lease.manual_status === 'processing' ? '#0891B2' : '#64748B', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
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
              <button onClick={saveSlack} disabled={savingSlack} style={{ marginTop: 6, padding: '7px 14px', borderRadius: 7, background: '#DC2626', color: '#fff', border: 'none', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: savingSlack ? 0.7 : 1 }}>
                {savingSlack ? 'Saving…' : 'Save Slack Link'}
              </button>
            </div>
          )}
        </div>

        {/* Intercom */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', marginBottom: 8, fontFamily: 'Montserrat, sans-serif' }}>INTERCOM CONVERSATION</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={intercomLink} onChange={e => setIntercomLink(e.target.value)} placeholder="Paste Intercom conversation link…"
              style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', fontSize: 12, outline: 'none' }} />
            {intercomLink && <a href={intercomLink} target="_blank" rel="noreferrer" style={{ padding: '9px 12px', borderRadius: 8, background: '#EEF3F7', color: '#2C4F6B', fontWeight: 700, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' as const }}>Open ↗</a>}
          </div>
          <button onClick={saveIntercom} disabled={savingIntercom} style={{ marginTop: 8, padding: '8px 16px', borderRadius: 7, background: '#2C4F6B', color: '#fff', border: 'none', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: savingIntercom ? 0.7 : 1 }}>
            {savingIntercom ? 'Saving…' : 'Save Link'}
          </button>
        </div>

        {/* Notes CRM Log */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'Montserrat, sans-serif' }}>ACTIVITY LOG</div>
          {/* Add new note */}
          <div style={{ marginBottom: 12 }}>
            <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note or update…"
              style={{ width: '100%', minHeight: 70, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', fontSize: 13, resize: 'vertical', outline: 'none' }} />
            <button onClick={handleAddNote} disabled={savingNote || !newNote.trim()}
              style={{ marginTop: 6, padding: '8px 16px', borderRadius: 7, background: newNote.trim() ? '#2C4F6B' : '#E2E8F0', color: newNote.trim() ? '#fff' : '#94A3B8', border: 'none', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, cursor: newNote.trim() ? 'pointer' : 'not-allowed', opacity: savingNote ? 0.7 : 1 }}>
              {savingNote ? 'Saving…' : 'Add Note'}
            </button>
          </div>
          {/* Notes history */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.length === 0 ? (
              <div style={{ padding: '12px', background: '#FEF2F2', borderRadius: 8, fontSize: 12, color: '#DC2626', fontFamily: 'Montserrat, sans-serif', fontWeight: 500, textAlign: 'center' }}>
                ⚠️ No notes yet — add an update
              </div>
            ) : notes.map(n => (
              <div key={n.id} style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#2C4F6B', fontFamily: 'Montserrat, sans-serif' }}>{n.author}</span>
                  <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'Montserrat, sans-serif' }}>{new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p style={{ fontSize: 13, color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', margin: 0, lineHeight: 1.5 }}>{n.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardInner() {
  const searchParams = useSearchParams()
  const [leases, setLeases] = useState<Lease[]>([])
  const [checklist, setChecklist] = useState<ChecklistMap>({})
  const [notesMap, setNotesMap] = useState<Record<string, LeaseNote[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [liveIndicator, setLiveIndicator] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [search, setSearch] = useState('')
  const [filterConcierges, setFilterConcierges] = useState<string[]>(searchParams.getAll('concierge') || [])
  const [filterStatus, setFilterStatus] = useState<ComputedStatus | ''>(searchParams.get('status') as ComputedStatus || '')
  const [filterPayouts, setFilterPayouts] = useState<string[]>(searchParams.getAll('payoutPlan').length ? searchParams.getAll('payoutPlan') : ['Monthly'])
  const [filterLeaseTypes, setFilterLeaseTypes] = useState<string[]>(searchParams.getAll('leaseType').length ? searchParams.getAll('leaseType') : DEFAULT_LEASE_TYPES)
  const [filterAgreement, setFilterAgreement] = useState(searchParams.get('agreement') || 'active')
  const [showPaid, setShowPaid] = useState(false)
  const [showEscalated, setShowEscalated] = useState(false)
  const [filterMonth, setFilterMonth] = useState(searchParams.get('month') || '')
  const [filterRange, setFilterRange] = useState({ from: searchParams.get('dateFrom') || '', to: searchParams.get('dateTo') || '' })
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set())
  const [sortCol, setSortCol] = useState('lease_start_on')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const flashLive = useCallback(() => {
    setLiveIndicator(true)
    if (liveTimer.current) clearTimeout(liveTimer.current)
    liveTimer.current = setTimeout(() => setLiveIndicator(false), 1500)
  }, [])

  const loadData = useCallback(async () => {
    const [{ data: lData }, { data: cData }, { data: nData }] = await Promise.all([
      supabase.from('leases').select('*'),
      supabase.from('checklist_items').select('*'),
      supabase.from('lease_notes').select('*').order('created_at', { ascending: false }),
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
      const map: Record<string, LeaseNote[]> = {}
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
      setUser(session.user)
      loadData()
    })

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lease_notes' }, (p) => {
        flashLive()
        const row = p.new as LeaseNote
        setNotesMap(prev => ({ ...prev, [row.lease_id]: [row, ...(prev[row.lease_id] || [])] }))
        setLeases(prev => prev.map(l => l.lease_id === row.lease_id ? { ...l, last_note_at: row.created_at } : l))
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

  const handleAddNote = async (leaseId: string, note: string) => {
    const author = user?.email?.split('@')[0] || user?.email || 'Unknown'
    await fetch('/api/add-note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lease_id: leaseId, note, author }) })
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

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.href = '/login' }
  const toggleCol = (col: string) => setHiddenCols(prev => { const s = new Set(prev); s.has(col) ? s.delete(col) : s.add(col); return s })
  const handleSort = (col: string) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc') } }

  const allConcierges = Array.from(new Set(leases.map(l => l.concierge).filter(Boolean))).sort()
  const allLeaseTypes = Array.from(new Set(leases.map(l => l.lease_type).filter(Boolean))).sort()

  const matchesDate = (lease: Lease) => {
    const d = lease.lease_start_on ? new Date(lease.lease_start_on) : null
    if (!d) return true
    if (filterMonth) {
      const [mon, yr] = filterMonth.split(' ')
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      return d.getMonth() === months.indexOf(mon) && d.getFullYear() === parseInt(yr)
    }
    if (filterRange.from) { const from = new Date(filterRange.from); if (d < from) return false }
    if (filterRange.to) { const to = new Date(filterRange.to); if (d > to) return false }
    return true
  }

  const getDone = (l: Lease) => CHECKLIST_ITEMS.filter(i => checklist[l.home_id]?.[i.key]).length
  const getStatus = (l: Lease) => computeStatus(l, getDone(l))

  const filtered = leases.filter(l => {
    const status = getStatus(l)
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
    const aStatus = getStatus(a); const bStatus = getStatus(b)
    if (a.escalated && !b.escalated) return -1
    if (!a.escalated && b.escalated) return 1
    let av: any, bv: any
    if (sortCol === 'status') { av = STATUS_CONFIG[aStatus].priority; bv = STATUS_CONFIG[bStatus].priority }
    else if (sortCol === 'lease_start_on') { av = a.lease_start_on ? new Date(a.lease_start_on).getTime() : 0; bv = b.lease_start_on ? new Date(b.lease_start_on).getTime() : 0 }
    else if (sortCol === 'rent_amount') { av = a.rent_amount; bv = b.rent_amount }
    else if (sortCol === 'open_payable_balance') { av = a.open_payable_balance; bv = b.open_payable_balance }
    else if (sortCol === 'checklist') { av = getDone(a); bv = getDone(b) }
    else if (sortCol === 'last_note_at') { av = a.last_note_at ? new Date(a.last_note_at).getTime() : 0; bv = b.last_note_at ? new Date(b.last_note_at).getTime() : 0 }
    else { av = (a as any)[sortCol] || ''; bv = (b as any)[sortCol] || '' }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  // Status counts using filtered
  const statusCounts = (Object.keys(STATUS_CONFIG) as ComputedStatus[]).reduce((acc, s) => {
    acc[s] = filtered.filter(l => getStatus(l) === s).length
    return acc
  }, {} as Record<ComputedStatus, number>)

  const cols = [
    { key: 'address', label: 'Address', frozen: true },
    { key: 'concierge', label: 'Concierge', frozen: true },
    { key: 'homeowner_name', label: 'Homeowner' },
    { key: 'status', label: 'Status' },
    { key: 'checklist', label: 'Setup' },
    { key: 'last_note_at', label: 'Last Update' },
    { key: 'lease_start_on', label: 'Lease Start' },
    { key: 'rent_amount', label: 'Rent' },
    { key: 'payout_plan', label: 'Payout Plan' },
    { key: 'lease_type', label: 'Lease Type' },
    { key: 'failed_months', label: 'Open Months' },
    { key: 'open_payable_balance', label: 'Open Balance' },
  ]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16, background: '#F5F7FA' }}>
      <div style={{ fontSize: 32, fontWeight: 700, color: '#2C4F6B', fontFamily: 'Montserrat, sans-serif' }}>belong<span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#2DD4A0', marginLeft: 2, verticalAlign: 'middle' }} /></div>
      <div style={{ width: 28, height: 28, border: '3px solid #E2E8F0', borderTop: '3px solid #2DD4A0', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', fontFamily: 'Montserrat, sans-serif' }}>
      <header style={{ background: '#2C4F6B', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 2px 12px rgba(44,79,107,0.18)' }}>
        <div style={{ padding: '13px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>belong<span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#2DD4A0', marginLeft: 2, verticalAlign: 'middle' }} /></div>
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Homeowner Payouts</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Payment Readiness Tracker</div>
            </div>
            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              <a href="/" style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.15)', textDecoration: 'none' }}>Tracker</a>
              <a href="/reports" style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Reports</a>
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
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{user?.email}</span>
              <button onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, padding: 0 }}>Sign out</button>
            </div>
          </div>
        </div>
      </header>

      <div style={{ padding: '20px 24px' }}>
        {/* Status cards - all 6 statuses */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {(Object.keys(STATUS_CONFIG) as ComputedStatus[]).map(s => {
            const cfg = STATUS_CONFIG[s]
            const isSelected = filterStatus === s
            return (
              <button key={s} title={cfg.tooltip} onClick={() => { setFilterStatus(isSelected ? '' : s); if (s === 'paid') setShowPaid(true) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: '#fff', border: `1.5px solid ${isSelected ? cfg.color : '#E2E8F0'}`, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.2s', position: 'relative' as const }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: cfg.color, fontFamily: 'Montserrat, sans-serif' }}>{statusCounts[s]}</span>
                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, fontStyle: cfg.italic ? 'italic' : 'normal' }}>
                  {cfg.label}{cfg.italic ? ' (future)' : ''}
                </span>
              </button>
            )
          })}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#64748B', fontWeight: 600, marginLeft: 'auto' }}>
            <input type="checkbox" checked={showPaid} onChange={e => setShowPaid(e.target.checked)} style={{ accentColor: '#2C4F6B' }} />Show Paid
          </label>
        </div>

        {/* Filters */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name, address, concierge…"
              style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', fontSize: 12, outline: 'none' }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ComputedStatus | '')} style={selectStyle}>
              <option value="">All Statuses</option>
              {(Object.keys(STATUS_CONFIG) as ComputedStatus[]).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}{STATUS_CONFIG[s].italic ? ' (future)' : ''}</option>)}
            </select>
            <select value={filterAgreement} onChange={e => setFilterAgreement(e.target.value)} style={selectStyle}>
              <option value="active">Active Agreements</option>
              <option value="inactive">Inactive</option>
              <option value="">All</option>
            </select>
            <button onClick={() => { setSearch(''); setFilterConcierges([]); setFilterStatus(''); setFilterPayouts(['Monthly']); setFilterLeaseTypes(DEFAULT_LEASE_TYPES); setFilterAgreement('active'); setShowEscalated(false); setFilterMonth(''); setFilterRange({ from: '', to: '' }) }}
              style={{ padding: '8px 12px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#94A3B8', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Clear</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <MultiSelect label="All Concierges" options={allConcierges} selected={filterConcierges} onChange={setFilterConcierges} />
            <MultiSelect label="Payout Plan" options={['Monthly', 'NoGuarantee']} selected={filterPayouts} onChange={setFilterPayouts} />
            <MultiSelect label="Lease Type" options={allLeaseTypes} selected={filterLeaseTypes} onChange={setFilterLeaseTypes} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', borderRadius: 6, border: '1.5px solid #E2E8F0', overflow: 'hidden' }}>
                {(['month', 'range'] as const).map(m => (
                  <button key={m} onClick={() => { if (m === 'month') setFilterRange({ from: '', to: '' }); else setFilterMonth('') }}
                    style={{ padding: '6px 10px', border: 'none', background: (m === 'month' ? filterMonth : filterRange.from || filterRange.to) ? '#2C4F6B' : '#F8FAFC', color: (m === 'month' ? filterMonth : filterRange.from || filterRange.to) ? '#fff' : '#64748B', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                    {m === 'month' ? 'Month' : 'Range'}
                  </button>
                ))}
              </div>
              <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setFilterRange({ from: '', to: '' }) }} style={selectStyle}>
                <option value="">All Months</option>
                {['Jan 2026','Feb 2026','Mar 2026','Apr 2026','May 2026','Jun 2026','Jul 2026','Aug 2026','Sep 2026','Oct 2026','Nov 2026','Dec 2026','Jan 2027'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="date" value={filterRange.from} onChange={e => { setFilterRange(r => ({ ...r, from: e.target.value })); setFilterMonth('') }} style={{ ...selectStyle, width: 130 }} />
              <span style={{ fontSize: 11, color: '#94A3B8' }}>→</span>
              <input type="date" value={filterRange.to} onChange={e => { setFilterRange(r => ({ ...r, to: e.target.value })); setFilterMonth('') }} style={{ ...selectStyle, width: 130 }} />
            </div>
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
                      style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', cursor: 'pointer', whiteSpace: 'nowrap' as const, userSelect: 'none' as const, position: c.frozen ? 'sticky' as const : 'static' as const, left: c.key === 'address' ? 0 : c.key === 'concierge' ? 220 : 'auto', background: '#F8FAFC', zIndex: c.frozen ? 2 : 'auto' }}>
                      {c.label.toUpperCase()} {sortCol === c.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={cols.length} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>No leases match your filters</td></tr>
                ) : filtered.map((lease, idx) => {
                  const done = getDone(lease)
                  const status = getStatus(lease)
                  const isSelected = selectedLease?.lease_id === lease.lease_id
                  const leaseNotes = notesMap[lease.lease_id] || []
                  const hasNoNotes = leaseNotes.length === 0 && status !== 'paid'
                  const rowBg = lease.escalated ? '#FFF5F5' : isSelected ? '#F0F4FF' : hasNoNotes ? '#FFF8F8' : idx % 2 === 0 ? '#fff' : '#FAFBFC'

                  return (
                    <tr key={lease.lease_id} onClick={() => setSelectedLease(isSelected ? null : lease)}
                      style={{ borderBottom: `1px solid ${hasNoNotes ? '#FEE2E2' : '#F0F4F8'}`, background: rowBg, cursor: 'pointer', transition: 'background 0.15s' }}>
                      {!hiddenCols.has('address') && (
                        <td style={{ padding: '11px 14px', position: 'sticky' as const, left: 0, background: rowBg, zIndex: 1, maxWidth: 220, minWidth: 180 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {lease.escalated && (lease.escalation_slack_link
                              ? <a href={lease.escalation_slack_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, textDecoration: 'none' }}>🚨</a>
                              : <span style={{ fontSize: 12 }}>🚨</span>)}
                            <a href={`https://foundation.bln.hm/homes/${lease.home_id}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                              style={{ color: '#2C4F6B', fontWeight: 600, fontSize: 12, textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, display: 'block', maxWidth: 200 }}>{lease.address}</a>
                          </div>
                        </td>
                      )}
                      {!hiddenCols.has('concierge') && <td style={{ padding: '11px 14px', position: 'sticky' as const, left: hiddenCols.has('address') ? 0 : 220, background: rowBg, zIndex: 1, whiteSpace: 'nowrap' as const, color: '#1A3A5C', fontWeight: 500 }}>{lease.concierge}</td>}
                      {!hiddenCols.has('homeowner_name') && <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' as const }}>
                        {lease.homeowner_link ? <a href={lease.homeowner_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#2C4F6B', fontWeight: 600, textDecoration: 'underline' }}>{lease.homeowner_name}</a> : <span style={{ color: '#1A3A5C', fontWeight: 600 }}>{lease.homeowner_name}</span>}
                      </td>}
                      {!hiddenCols.has('status') && <td style={{ padding: '11px 14px' }}><StatusBadge status={status} /></td>}
                      {!hiddenCols.has('checklist') && <td style={{ padding: '11px 14px' }}><CheckProgress done={done} total={CHECKLIST_ITEMS.length} /></td>}
                      {!hiddenCols.has('last_note_at') && <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' as const }}>
                        {lease.last_note_at
                          ? <span style={{ fontSize: 11, color: '#64748B' }}>{new Date(lease.last_note_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          : <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>No updates</span>}
                      </td>}
                      {!hiddenCols.has('lease_start_on') && <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' as const }}>
                        {lease.lease_start_on ? <a href={lease.lease_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#2C4F6B', textDecoration: 'underline', fontWeight: 600 }}>{new Date(lease.lease_start_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</a> : '—'}
                      </td>}
                      {!hiddenCols.has('rent_amount') && <td style={{ padding: '11px 14px', color: '#1A3A5C', fontWeight: 600, whiteSpace: 'nowrap' as const }}>${lease.rent_amount?.toLocaleString()}</td>}
                      {!hiddenCols.has('payout_plan') && <td style={{ padding: '11px 14px' }}><Badge label={lease.payout_plan === 'Monthly' ? '● Guaranteed' : '○ No Guarantee'} color={lease.payout_plan === 'Monthly' ? '#1A3A5C' : '#94A3B8'} bg={lease.payout_plan === 'Monthly' ? '#EEF3F7' : '#F8FAFC'} /></td>}
                      {!hiddenCols.has('lease_type') && <td style={{ padding: '11px 14px' }}><Badge label={lease.lease_type} color='#6D28D9' bg='#F5F3FF' /></td>}
                      {!hiddenCols.has('failed_months') && <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' as const }}>
                        {lease.open_payable_count > 0
                          ? <span style={{ color: '#DC2626', fontWeight: 700 }}>{lease.open_payable_count} mo{lease.first_open_payable_month ? ` (${lease.first_open_payable_month}${lease.last_open_payable_month && lease.last_open_payable_month !== lease.first_open_payable_month ? `→${lease.last_open_payable_month}` : ''})` : ''}</span>
                          : <span style={{ color: '#94A3B8' }}>—</span>}
                      </td>}
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
          <SidePanel
            lease={selectedLease}
            checklist={checklist[selectedLease.home_id] || {}}
            notes={notesMap[selectedLease.lease_id] || []}
            onClose={() => setSelectedLease(null)}
            onToggle={handleToggle}
            onUpdateLease={handleUpdateLease}
            onAddNote={handleAddNote}
            toggling={toggling}
            currentUser={user}
          />
        </>
      )}
    </div>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div style={{ width: 28, height: 28, border: '3px solid #E2E8F0', borderTop: '3px solid #2DD4A0', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
      <DashboardInner />
    </Suspense>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 7, border: '1.5px solid #E2E8F0', background: '#F8FAFC',
  color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', fontSize: 12, outline: 'none', cursor: 'pointer',
}
