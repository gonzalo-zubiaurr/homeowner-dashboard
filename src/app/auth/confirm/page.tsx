'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ALLOWED_DOMAINS = ['belonghome.com', 'belong.pe']

export default function AuthConfirm() {
  const [status, setStatus] = useState('Signing you in…')

  useEffect(() => {
    const check = async () => {
      // Wait a moment for Supabase to process the hash
      await new Promise(r => setTimeout(r, 1000))
      
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        setStatus('Authentication error. Redirecting…')
        setTimeout(() => window.location.replace('/login?error=auth'), 1500)
        return
      }

      if (session?.user) {
        const email = session.user.email || ''
        if (ALLOWED_DOMAINS.some(d => email.endsWith(`@${d}`))) {
          setStatus('Welcome! Redirecting to dashboard…')
          // Force a hard navigation to ensure cookies are set
          window.location.replace('/')
        } else {
          await supabase.auth.signOut()
          window.location.replace('/login?error=domain')
        }
        return
      }

      // No session yet — try listening for it
      setStatus('Verifying credentials…')
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          subscription.unsubscribe()
          const email = session.user.email || ''
          if (ALLOWED_DOMAINS.some(d => email.endsWith(`@${d}`))) {
            window.location.replace('/')
          } else {
            supabase.auth.signOut().then(() => {
              window.location.replace('/login?error=domain')
            })
          }
        }
      })

      // Final fallback after 8 seconds
      setTimeout(() => {
        subscription.unsubscribe()
        window.location.replace('/login?error=auth')
      }, 8000)
    }

    check()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#2C4F6B' }}>belong<span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#2DD4A0', marginLeft: 2, verticalAlign: 'middle' }} /></div>
      <div style={{ width: 28, height: 28, border: '3px solid #E2E8F0', borderTop: '3px solid #2DD4A0', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <p style={{ color: '#64748B', fontSize: 13 }}>{status}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
