/**
 * Auth.jsx — TradeDaddy
 * Calls the Cloudflare Worker for real signup/login
 * No Firebase. No .env needed.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, auth } from '../utils/api'

export default function Auth() {
  const [mode,    setMode]    = useState('login')
  const [form,    setForm]    = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const navigate = useNavigate()

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Please fill all fields.'); return }
    if (mode === 'signup' && !form.name) { setError('Name is required.'); return }
    setLoading(true)
    try {
      let res
      if (mode === 'login') {
        res = await api.login(form.email, form.password)
      } else {
        res = await api.signup(form.email, form.password, form.name)
      }
      auth.setToken(res.token)
      auth.setUser(res.user)
      navigate('/dashboard')
    } catch (e) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#09070f', fontFamily: "'Space Grotesk', sans-serif", position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 700, background: 'radial-gradient(circle, rgba(82,39,255,0.1) 0%, transparent 65%)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '15%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(155,89,182,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, padding: '0 20px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', marginBottom: 8 }}>
            Trade<span style={{ color: '#5227FF' }}>Daddy</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            {mode === 'login' ? 'Welcome back, trader.' : 'Start your trading journal.'}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '36px 32px', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>

          {/* Tab toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 28 }}>
            {[['login','Sign In'],['signup','Sign Up']].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setError('') }} style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', borderRadius: 9,
                fontWeight: 600, fontSize: 14, fontFamily: 'inherit', transition: 'all 0.25s',
                background: mode === m ? '#5227FF' : 'transparent',
                color: mode === m ? '#fff' : 'rgba(255,255,255,0.4)',
              }}>{label}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <Field label="Full Name" type="text" value={form.name} onChange={v => set('name', v)} placeholder="Your name" />
            )}
            <Field label="Email"    type="email"    value={form.email}    onChange={v => set('email', v)}    placeholder="trader@example.com" />
            <Field label="Password" type="password" value={form.password} onChange={v => set('password', v)} placeholder="••••••••" />

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.2)', borderRadius: 10, fontSize: 13, color: '#FF5C5C', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              marginTop: 4, padding: '14px 0', border: 'none', borderRadius: 12,
              background: loading ? 'rgba(82,39,255,0.5)' : '#5227FF',
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em',
            }}>
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          {/* Cloudflare worker badge */}
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(249,131,22,0.08)', border: '1px solid rgba(249,131,22,0.2)', borderRadius: 999, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              <svg width="12" height="12" viewBox="0 0 32 32" fill="none"><path d="M25.74 19.26a6.3 6.3 0 0 1-1.1.1 6.36 6.36 0 0 1-6.01-8.45A8.49 8.49 0 0 0 7.5 17.5v.5H6.36A3.86 3.86 0 0 0 4 25.14V25h24v-.14a3.86 3.86 0 0 0-2.26-5.6z" fill="#F38020"/></svg>
              Auth secured by Cloudflare Workers
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
            Your data is stored in Cloudflare D1 · Images in Cloudflare R2
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '12px 14px', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 14,
          border: `1px solid ${focused ? '#5227FF' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 10, outline: 'none', fontFamily: 'inherit',
          transition: 'border-color 0.2s',
        }}
      />
    </div>
  )
}