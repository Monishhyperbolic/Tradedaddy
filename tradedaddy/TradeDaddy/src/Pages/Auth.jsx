/**
 * Auth.jsx — TradeDaddy
 * Multi-user safe: clears ALL previous user data before login/signup
 * Uses Cloudflare Worker for auth (no Firebase)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signup, login, auth, logoutUser } from '../utils/api'

const T = {
  bg: '#07050e', card: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)',
  p: '#5B2EFF', g: '#2ECC8A', r: '#FF4D6A',
  t: 'rgba(255,255,255,0.92)', m: 'rgba(255,255,255,0.45)', d: 'rgba(255,255,255,0.25)',
  font: "'DM Sans','Space Grotesk',sans-serif",
}

function Field({ label, type, value, onChange, placeholder, autoComplete }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:T.m, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width:'100%', padding:'12px 14px', boxSizing:'border-box',
          background:'rgba(255,255,255,0.055)', color:T.t, fontSize:14,
          border:`1.5px solid ${focused ? T.p : T.border}`,
          borderRadius:12, outline:'none', fontFamily:T.font,
          transition:'border-color 0.2s',
        }}
      />
    </div>
  )
}

export default function Auth() {
  const [mode,    setMode]    = useState('login')
  const [form,    setForm]    = useState({ name:'', email:'', password:'' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const navigate = useNavigate()

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError('') }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Please fill all fields.'); return }
    if (mode === 'signup' && !form.name.trim()) { setError('Name is required.'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    try {
      // ── CRITICAL: Clear ALL previous user data before logging in ──
      // This ensures User B never sees User A's cached data
      logoutUser()

      const res = mode === 'login'
        ? await login(form.email.trim().toLowerCase(), form.password)
        : await signup(form.email.trim().toLowerCase(), form.password, form.name.trim())

      auth.setToken(res.token)
      auth.setUser(res.user)
      navigate('/dashboard', { replace: true })
    } catch(e) {
      setError(e.message || 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (m) => { setMode(m); setError(''); setForm({ name:'', email:'', password:'' }) }

  return (
    <div className="auth-shell" style={{ fontFamily:T.font }}>
      <div style={{ position:'absolute', top:'10%', left:'50%', transform:'translateX(-50%)', width:800, height:800, background:'radial-gradient(circle, rgba(91,46,255,0.08) 0%, transparent 60%)', borderRadius:'50%', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:'5%', right:'10%', width:400, height:400, background:'radial-gradient(circle, rgba(46,204,138,0.05) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }}/>

      <div className="auth-grid">
        <div className="auth-card" style={{ margin: '0 auto', maxWidth: '480px' }}>
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ width:38, height:38, background:'linear-gradient(135deg, #5B2EFF, #9B59B6)', borderRadius:12, display:'grid', placeItems:'center', fontSize:12, fontWeight:800, letterSpacing:'0.08em', color:'#fff' }}>TD</div>
              <span style={{ fontSize:28, fontWeight:900, letterSpacing:'-0.04em', color:'#fff' }}>
                Trade<span style={{ color:T.p }}>Daddy</span>
              </span>
            </div>
            <p style={{ margin:0, fontSize:14, color:T.m }}>
              {mode === 'login' ? 'Welcome back. Sign in to your account.' : 'Create your account and start journaling.'}
            </p>
          </div>

          <div className="auth-toggle" style={{ marginBottom:28 }}>
            {[['login','Sign In'],['signup','Sign Up']].map(([m, label]) => (
              <button key={m} type="button" onClick={() => switchMode(m)} className={mode===m ? 'is-active' : ''}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'signup' && (
              <Field label="Full Name" type="text" value={form.name} onChange={v=>set('name',v)} placeholder="Your full name" autoComplete="name"/>
            )}
            <Field label="Email Address" type="email" value={form.email} onChange={v=>set('email',v)} placeholder="you@example.com" autoComplete="email"/>
            <Field label="Password" type="password" value={form.password} onChange={v=>set('password',v)} placeholder="Min. 6 characters" autoComplete={mode==='login'?'current-password':'new-password'}/>

            {error && (
              <div style={{ padding:'11px 14px', background:'rgba(255,77,106,0.09)', border:'1px solid rgba(255,77,106,0.22)', borderRadius:11, fontSize:13, color:T.r, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:18,height:18,borderRadius:6,display:'grid',placeItems:'center',background:'rgba(255,77,106,0.16)',fontSize:11,fontWeight:800 }}>!</span> {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="auth-button landing-start-btn" style={{ width:'100%', marginTop:4, opacity: loading ? 0.75 : 1 }}>
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign In →' : 'Create Account →')}
            </button>
          </form>


        </div>
      </div>
    </div>
  )
}