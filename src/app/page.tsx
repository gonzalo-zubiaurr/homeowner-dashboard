'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, CHECKLIST_ITEMS, type Homeowner, type ChecklistItem } from '@/lib/supabase'

type ChecklistMap = Record<string, Record<string, boolean>>

function getProgress(checks: Record<string, boolean> | undefined) {
  if (!checks) return 0
  return CHECKLIST_ITEMS.filter(i => checks[i.key]).length
}

function StatusBadge({ count }: { count: number }) {
  const total = CHECKLIST_ITEMS.length
  if (count === total) return <span style={badgeStyle('#22c55e', '#0d2e1a')}>✓ Ready to Pay</span>
  if (count === 0)     return <span style={badgeStyle('#ef4444', '#2a0d0d')}>Not Started</span>
  return <span style={badgeStyle('#f59e0b', '#2a1f07')}>{count}/{total} Done</span>
}

function badgeStyle(color: string, bg: string) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 10px', borderRadius: 999, fontSize: 11,
    fontWeight: 600, letterSpacing: '0.04em',
    color, background: bg, border: `1px solid ${color}30`,
    whiteSpace: 'nowrap' as const,
  }
}

export default function Dashboard() {
  const [homeowners, setHomeowners] = useState<Homeowner[]>([])
  const [checklist, setChecklist] = useState<ChecklistMap>({})
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'ready' | 'pending' | 'not-started'>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [liveIndicator, setLiveIndicator] = useState(false)
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashLive = useCallback(() => {
    setLiveIndicator(true)
    if (liveTimer.current) clearTimeout(liveTimer.current)
    liveTimer.current = setTimeout(() => setLiveIndicator(false), 1500)
  }, [])

  // Load initial data
  const loadData = useCallback(async () => {
    const [{ data: hData }, { data: cData }] = await Promise.all([
      supabase.from('homeowners').select('*').order('name'),
      supabase.from('checklist_items').select('*'),
    ])
    if (hData) setHomeowners(hData)
    if (cData) {
      const map: ChecklistMap = {}
      ;(cData as ChecklistItem[]).forEach(item => {
        if (!map[item.homeowner_id]) map[item.homeowner_id] = {}
        map[item.homeowner_id][item.item_key] = item.completed
      })
      setChecklist(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()

    // Real-time subscription on checklist_items
    const channel = supabase
      .channel('checklist-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items' },
        (payload) => {
          flashLive()
          const row = payload.new as ChecklistItem
          if (!row) return
          setChecklist(prev => ({
            ...prev,
            [row.homeowner_id]: {
              ...(prev[row.homeowner_id] || {}),
              [row.item_key]: row.completed,
            }
          }))
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'homeowners' },
        (payload) => {
          flashLive()
          const row = payload.new as Homeowner
          setHomeowners(prev => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadData, flashLive])

  const toggle = async (homeownerId: string, itemKey: string, current: boolean) => {
    const key = `${homeownerId}:${itemKey}`
    if (toggling.has(key)) return
    setToggling(prev => new Set(prev).add(key))

    // Optimistic update
    setChecklist(prev => ({
      ...prev,
      [homeownerId]: { ...(prev[homeownerId] || {}), [itemKey]: !current }
    }))

    try {
      await fetch('/api/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeowner_id: homeownerId, item_key: itemKey, completed: !current }),
      })
    } catch {
      // Revert on error
      setChecklist(prev => ({
        ...prev,
        [homeownerId]: { ...(prev[homeownerId] || {}), [itemKey]: current }
      }))
    } finally {
      setToggling(prev => { const s = new Set(prev); s.delete(key); return s })
    }
  }

  const syncSheets = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/sync-sheets', { method: 'POST' })
      const data = await res.json()
      if (data.error) setSyncMsg(`❌ ${data.error}`)
      else {
        setSyncMsg(`✅ ${data.message}`)
        await loadData()
      }
    } catch {
      setSyncMsg('❌ Network error')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(''), 5000)
    }
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const expandAll = () => setExpanded(new Set(homeowners.map(h => h.id)))
  const collapseAll = () => setExpanded(new Set())

  // Filter + search
  const filtered = homeowners.filter(h => {
    const prog = getProgress(checklist[h.id])
    const total = CHECKLIST_ITEMS.length
    const matchSearch = h.name.toLowerCase().includes(search.toLowerCase()) ||
      (h.unit || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ? true :
      filter === 'ready' ? prog === total :
      filter === 'pending' ? (prog > 0 && prog < total) :
      prog === 0
    return matchSearch && matchFilter
  })

  const stats = {
    total: homeowners.length,
    ready: homeowners.filter(h => getProgress(checklist[h.id]) === CHECKLIST_ITEMS.length).length,
    pending: homeowners.filter(h => { const p = getProgress(checklist[h.id]); return p > 0 && p < CHECKLIST_ITEMS.length }).length,
    notStarted: homeowners.filter(h => getProgress(checklist[h.id]) === 0).length,
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:12 }}>
      <div style={spinnerStyle} />
      <p style={{ color:'var(--text-muted)', fontSize:14 }}>Loading dashboard…</p>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🏠</div>
            <div>
              <h1 style={{ fontSize:18, fontWeight:600, color:'var(--text)', letterSpacing:'-0.02em' }}>Homeowner Onboarding</h1>
              <p style={{ fontSize:12, color:'var(--text-muted)' }}>Payment Readiness Tracker</p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:6, background: liveIndicator ? '#0d2e1a' : 'var(--surface2)', border:`1px solid ${liveIndicator ? '#22c55e40' : 'var(--border)'}`, transition:'all 0.3s' }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background: liveIndicator ? '#22c55e' : 'var(--text-muted)', transition:'all 0.3s', boxShadow: liveIndicator ? '0 0 8px #22c55e' : 'none' }} />
              <span style={{ fontSize:11, color: liveIndicator ? '#22c55e' : 'var(--text-muted)', fontWeight:500 }}>LIVE</span>
            </div>
            <button onClick={syncSheets} disabled={syncing} style={btnStyle(syncing)}>
              {syncing ? '⏳ Syncing…' : '↻ Sync Google Sheets'}
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth:1200, margin:'0 auto', padding:'24px' }}>
        {syncMsg && <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:8, background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', fontSize:13 }}>{syncMsg}</div>}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, marginBottom:24 }}>
          {[
            { label:'Total Homeowners', value: stats.total, color:'var(--accent)', onClick: () => setFilter('all'), active: filter==='all' },
            { label:'Ready to Pay', value: stats.ready, color:'#22c55e', onClick: () => setFilter(filter==='ready'?'all':'ready'), active: filter==='ready' },
            { label:'In Progress', value: stats.pending, color:'#f59e0b', onClick: () => setFilter(filter==='pending'?'all':'pending'), active: filter==='pending' },
            { label:'Not Started', value: stats.notStarted, color:'#ef4444', onClick: () => setFilter(filter==='not-started'?'all':'not-started'), active: filter==='not-started' },
          ].map(s => (
            <button key={s.label} onClick={s.onClick} style={statCardStyle(s.active, s.color)}>
              <span style={{ fontSize:28, fontWeight:700, color: s.color, fontFamily:'DM Mono, monospace' }}>{s.value}</span>
              <span style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom:24, padding:'16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:500 }}>OVERALL READINESS</span>
            <span style={{ fontSize:12, color:'var(--text)', fontFamily:'DM Mono, monospace' }}>
              {stats.ready}/{stats.total} ready to pay
            </span>
          </div>
          <div style={{ height:8, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${stats.total ? (stats.ready/stats.total)*100 : 0}%`, background:'linear-gradient(90deg, #22c55e, #4ade80)', borderRadius:4, transition:'width 0.5s ease' }} />
          </div>
        </div>

        {/* Search + controls */}
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍  Search homeowner or unit…"
            style={searchStyle}
          />
          <button onClick={expandAll} style={smallBtn}>Expand All</button>
          <button onClick={collapseAll} style={smallBtn}>Collapse All</button>
          <span style={{ marginLeft:'auto', fontSize:12, color:'var(--text-muted)' }}>
            Showing {filtered.length} of {homeowners.length}
          </span>
        </div>

        {/* Homeowner list */}
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-muted)' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <p>No homeowners match your search.</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(h => {
              const checks = checklist[h.id] || {}
              const prog = getProgress(checks)
              const isExpanded = expanded.has(h.id)
              const isReady = prog === CHECKLIST_ITEMS.length

              return (
                <div key={h.id} style={cardStyle(isReady)}>
                  {/* Card header */}
                  <button
                    onClick={() => toggleExpand(h.id)}
                    style={{ width:'100%', background:'none', border:'none', padding:'14px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:12, textAlign:'left' }}
                  >
                    <div style={{ width:36, height:36, borderRadius:8, background: isReady ? '#0d2e1a' : 'var(--surface2)', border:`1px solid ${isReady ? '#22c55e40' : 'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                      {isReady ? '✅' : '🏠'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:600, color:'var(--text)', fontSize:14 }}>{h.name}</span>
                        {h.unit && <span style={{ fontSize:11, color:'var(--text-muted)', padding:'1px 7px', background:'var(--surface2)', borderRadius:4 }}>Unit {h.unit}</span>}
                        {h.lease_start && <span style={{ fontSize:11, color:'var(--text-muted)' }}>Lease: {h.lease_start}</span>}
                      </div>
                      {/* Mini progress */}
                      <div style={{ display:'flex', gap:4, marginTop:6, alignItems:'center' }}>
                        {CHECKLIST_ITEMS.map(item => (
                          <div key={item.key} title={item.label} style={{ width:20, height:4, borderRadius:2, background: checks[item.key] ? '#22c55e' : 'var(--border)', transition:'background 0.2s' }} />
                        ))}
                        <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:4 }}>{prog}/{CHECKLIST_ITEMS.length}</span>
                      </div>
                    </div>
                    <StatusBadge count={prog} />
                    <span style={{ color:'var(--text-muted)', fontSize:12, marginLeft:4, transition:'transform 0.2s', display:'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </button>

                  {/* Expanded checklist */}
                  {isExpanded && (
                    <div style={{ padding:'0 18px 16px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:8 }}>
                      {CHECKLIST_ITEMS.map(item => {
                        const done = !!checks[item.key]
                        const key = `${h.id}:${item.key}`
                        const isToggling = toggling.has(key)
                        return (
                          <button
                            key={item.key}
                            onClick={() => toggle(h.id, item.key, done)}
                            disabled={isToggling}
                            style={checkItemStyle(done, isToggling)}
                          >
                            <div style={{ width:20, height:20, borderRadius:4, border:`2px solid ${done ? '#22c55e' : 'var(--border2)'}`, background: done ? '#22c55e' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                              {done && <span style={{ color:'#fff', fontSize:12, lineHeight:1 }}>✓</span>}
                            </div>
                            <span style={{ fontSize:13 }}>{item.icon}</span>
                            <span style={{ fontWeight:500, color: done ? '#22c55e' : 'var(--text)', textDecoration: done ? 'none' : 'none', transition:'color 0.15s' }}>{item.label}</span>
                            {isToggling && <div style={{ ...spinnerStyle, width:12, height:12, borderWidth:2, marginLeft:'auto' }} />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

// Styles
const headerStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border)',
  padding: '16px 0',
  background: 'var(--surface)',
  position: 'sticky',
  top: 0,
  zIndex: 50,
  backdropFilter: 'blur(12px)',
}

const spinnerStyle: React.CSSProperties = {
  width: 24, height: 24,
  border: '3px solid var(--border)',
  borderTop: '3px solid var(--accent)',
  borderRadius: '50%',
  animation: 'spin 0.7s linear infinite',
}

const btnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 8,
  background: disabled ? 'var(--surface2)' : 'var(--accent)',
  color: disabled ? 'var(--text-muted)' : '#fff',
  border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: 13, fontWeight: 600,
  transition: 'background 0.2s',
})

const statCardStyle = (active: boolean, color: string): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
  padding: '16px', borderRadius: 12,
  background: active ? `${color}15` : 'var(--surface)',
  border: `1px solid ${active ? `${color}60` : 'var(--border)'}`,
  cursor: 'pointer', transition: 'all 0.2s',
  textAlign: 'left',
})

const searchStyle: React.CSSProperties = {
  flex: 1, minWidth: 200, padding: '9px 14px',
  borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)',
  fontFamily: 'DM Sans, sans-serif', fontSize: 13,
  outline: 'none',
}

const smallBtn: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 7,
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text-muted)', cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif', fontSize: 12,
}

const cardStyle = (ready: boolean): React.CSSProperties => ({
  background: 'var(--surface)',
  border: `1px solid ${ready ? '#22c55e30' : 'var(--border)'}`,
  borderRadius: 12, overflow: 'hidden',
  transition: 'border-color 0.3s',
})

const checkItemStyle = (done: boolean, toggling: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 14px', borderRadius: 8,
  background: done ? 'var(--success-bg)' : 'var(--surface2)',
  border: `1px solid ${done ? '#22c55e30' : 'var(--border)'}`,
  cursor: toggling ? 'wait' : 'pointer',
  transition: 'all 0.15s', textAlign: 'left',
  opacity: toggling ? 0.6 : 1,
  fontFamily: 'DM Sans, sans-serif',
  width: '100%',
})
