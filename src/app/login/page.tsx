'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'domain') {
      setError('Access restricted to @belonghome.com and @belong.pe accounts only.')
    }
  }, [])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { hd: 'belonghome.com' },
      },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
      
      <div style={{ background: '#fff', borderRadius: 16, padding: '48px 40px', width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #E2E8F0', textAlign: 'center' }}>
        
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#2C4F6B', letterSpacing: '-1px', marginBottom: 4 }}>
            belong
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#2DD4A0', marginLeft: 3, verticalAlign: 'middle' }} />
          </div>
          <div style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>Homeowner Payouts Dashboard</div>
        </div>

        {/* Divider */}
        <div style={{ width: 40, height: 3, background: '#2DD4A0', borderRadius: 2, margin: '0 auto 32px' }} />

        <div style={{ fontSize: 22, fontWeight: 700, color: '#1A3A5C', marginBottom: 8 }}>Welcome back</div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 32, lineHeight: 1.6 }}>
          Sign in with your Belong Google account to access the dashboard.
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <button onClick={handleGoogleLogin} disabled={loading}
          style={{ width: '100%', padding: '14px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: loading ? '#F8FAFC' : '#fff', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 14, fontWeight: 600, color: '#1A3A5C', fontFamily: 'Montserrat, sans-serif', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {loading ? (
            <div style={{ width: 20, height: 20, border: '2px solid #E2E8F0', borderTop: '2px solid #2C4F6B', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? 'Signing in…' : 'Sign in with Google'}
        </button>

        <div style={{ marginTop: 24, fontSize: 11, color: '#94A3B8', lineHeight: 1.6 }}>
          Access restricted to <strong>@belonghome.com</strong> and <strong>@belong.pe</strong> accounts only.
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: '#CBD5E1' }}>belong · Internal Use Only</div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
