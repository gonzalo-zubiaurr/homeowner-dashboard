'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const ALLOWED_DOMAINS = ['belonghome.com', 'belong.pe']

export default function AuthConfirm() {
  useEffect(() => {
    const handleAuth = async () => {
      // Listen for auth state change — Supabase auto-processes the hash
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          subscription.unsubscribe()
          const email = session.user.email || ''
          if (ALLOWED_DOMAINS.some(d => email.endsWith(`@${d}`))) {
            window.location.replace('/')
          } else {
            await supabase.auth.signOut()
            window.location.replace('/login?error=domain')
          }
        } else if (event === 'INITIAL_SESSION' && !session) {
          // No session found after timeout
          setTimeout(() => {
            window.location.replace('/login?error=auth')
          }, 3000)
        }
      })
    }
    handleAuth()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#2C4F6B' }}>belong<span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#2DD4A0', marginLeft: 2, verticalAlign: 'middle' }} /></div>
      <div style={{ width: 28, height: 28, border: '3px solid #E2E8F0', borderTop: '3px solid #2DD4A0', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <p style={{ color: '#64748B', fontSize: 13 }}>Signing you in…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
