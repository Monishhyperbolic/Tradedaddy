import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signup, login, auth } from '../utils/api'

export default function Auth() {
  const [mode,    setMode]    = useState('login')
  const [form,    setForm]    = useState({ name:'', email:'', password:'' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const navigate = useNavigate()

  const set=(k,v)=>{setForm(f=>({...f,[k]:v}));setError('')}

  const handleSubmit=async e=>{
    e.preventDefault()
    if(!form.email||!form.password){setError('Fill all fields.');return}
    if(mode==='signup'&&!form.name){setError('Name required.');return}
    setLoading(true)
    try{
      const res=mode==='login'?await login(form.email,form.password):await signup(form.email,form.password,form.name)
      auth.setToken(res.token);auth.setUser(res.user);navigate('/dashboard')
    }catch(e){setError(e.message||'Something went wrong.')}finally{setLoading(false)}
  }

  return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#09070f',fontFamily:"'Space Grotesk',sans-serif",position:'relative',overflow:'hidden' }}>
      <div style={{ position:'absolute',top:'15%',left:'50%',transform:'translateX(-50%)',width:700,height:700,background:'radial-gradient(circle,rgba(82,39,255,0.1) 0%,transparent 65%)',borderRadius:'50%',pointerEvents:'none' }}/>
      <div style={{ position:'relative',zIndex:1,width:'100%',maxWidth:420,padding:'0 20px' }}>
        <div style={{ textAlign:'center',marginBottom:32 }}>
          <div style={{ fontSize:32,fontWeight:900,letterSpacing:'-0.04em',color:'#fff',marginBottom:8 }}>Trade<span style={{ color:'#5227FF' }}>Daddy</span></div>
          <p style={{ margin:0,fontSize:13,color:'rgba(255,255,255,0.35)' }}>{mode==='login'?'Welcome back, trader.':'Start your trading journal.'}</p>
        </div>
        <div style={{ background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:24,padding:'32px 28px',backdropFilter:'blur(24px)' }}>
          <div style={{ display:'flex',background:'rgba(255,255,255,0.05)',borderRadius:12,padding:4,marginBottom:24 }}>
            {[['login','Sign In'],['signup','Sign Up']].map(([m,l])=>(
              <button key={m} onClick={()=>{setMode(m);setError('')}} style={{ flex:1,padding:'10px 0',border:'none',cursor:'pointer',borderRadius:9,fontWeight:600,fontSize:14,fontFamily:'inherit',transition:'all 0.25s',background:mode===m?'#5227FF':'transparent',color:mode===m?'#fff':'rgba(255,255,255,0.4)' }}>{l}</button>
            ))}
          </div>
          <form onSubmit={handleSubmit} style={{ display:'flex',flexDirection:'column',gap:13 }}>
            {mode==='signup'&&<Field label="Full Name" type="text" value={form.name} onChange={v=>set('name',v)} placeholder="Your name"/>}
            <Field label="Email"    type="email"    value={form.email}    onChange={v=>set('email',v)}    placeholder="trader@example.com"/>
            <Field label="Password" type="password" value={form.password} onChange={v=>set('password',v)} placeholder="••••••••"/>
            {error&&<div style={{ padding:'9px 13px',background:'rgba(255,92,92,0.08)',border:'1px solid rgba(255,92,92,0.2)',borderRadius:10,fontSize:13,color:'#FF5C5C',textAlign:'center' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ marginTop:4,padding:'13px 0',border:'none',borderRadius:12,background:loading?'rgba(82,39,255,0.5)':'#5227FF',color:'#fff',fontSize:15,fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:'inherit' }}>
              {loading?(mode==='login'?'Signing in…':'Creating account…'):(mode==='login'?'Sign In':'Create Account')}
            </button>
          </form>
          <div style={{ marginTop:20,textAlign:'center' }}>
            <div style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'5px 12px',background:'rgba(249,131,22,0.08)',border:'1px solid rgba(249,131,22,0.2)',borderRadius:999,fontSize:11,color:'rgba(255,255,255,0.4)' }}>
              🔒 Secured by Cloudflare Workers + D1
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
function Field({ label,type,value,onChange,placeholder }) {
  const [focused,setFocused]=useState(false)
  return (
    <div>
      <label style={{ display:'block',fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.4)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.06em' }}>{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
        style={{ width:'100%',padding:'11px 13px',boxSizing:'border-box',background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:14,border:`1px solid ${focused?'#5227FF':'rgba(255,255,255,0.1)'}`,borderRadius:10,outline:'none',fontFamily:'inherit',transition:'border-color 0.2s' }}/>
    </div>
  )
}