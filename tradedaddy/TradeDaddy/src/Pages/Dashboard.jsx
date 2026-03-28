/**
 * Dashboard.jsx v5 — TradeDaddy
 * Fixes: user name from auth (not hardcoded), MT5/Dhan data per-user
 * Improvements: better UI, real data in AI, no HF token UI
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectMt5, disconnectMt5 } from '../utils/api'
import {
  getTrades, createTrade, updateTrade, deleteTrade,
  getHoldings, createHolding, deleteHolding, clearHoldings,
  uploadImage, connectDhan, getDhanHoldings, getDhanStatus, disconnectDhan,
  getMt5Positions, getMt5Status, getQuote, getNews, getCalendar,
  groqChat, getMe, auth, logoutUser,
} from '../utils/api'
import Scanner from './Scanner'
import Analytics from './Analytics'
import News from './News'
import EconomicCalendar from './EconomicCalendar'
import SectorAnalysis from './SectorAnalysis'

const T = {
  bg:'#07050e', card:'rgba(255,255,255,0.025)', border:'rgba(255,255,255,0.08)',
  borderHi:'rgba(255,255,255,0.13)', p:'#5B2EFF', pd:'rgba(91,46,255,0.18)',
  g:'#2ECC8A', r:'#FF4D6A', a:'#F5A623', b:'#3B9EFF',
  t:'rgba(255,255,255,0.92)', m:'rgba(255,255,255,0.5)', d:'rgba(255,255,255,0.3)', f:'rgba(255,255,255,0.06)',
  font:"'DM Sans','Space Grotesk',sans-serif", mono:"'JetBrains Mono','Fira Code',monospace",
}



const NAV = [
  { icon:'⬡',  label:'Dashboard', id:'dashboard' },
  { icon:'📋', label:'Journal',   id:'journal' },
  { icon:'💼', label:'Holdings',  id:'holdings' },
  { icon:'🔍', label:'Scanner',   id:'scanner' },
  { icon:'📊', label:'Analytics', id:'analytics' },
  { icon:'📈', label:'Sectors',   id:'sectors' },
  { icon:'📰', label:'News',      id:'news' },
  { icon:'📅', label:'Calendar',  id:'calendar' },
  { icon:'🤖', label:'AI Chat',   id:'chat' },
  { icon:'⚙',  label:'Settings',  id:'settings' },
]

const fmtInr = (n, compact=false) => {
  if (n==null) return '—'
  const abs = Math.abs(n)
  const sign = n>=0?'+':'-'
  if (compact && abs>=1e5) return `${sign}₹${(abs/1e5).toFixed(1)}L`
  return `${sign}₹${abs.toLocaleString('en-IN',{maximumFractionDigits:0})}`
}

function EquityChart({ trades }) {
  const BASE = 100000
  const sorted = [...trades].filter(t=>t.pnl!=null).sort((a,b)=>new Date(a.date)-new Date(b.date))
  const curve  = [BASE]
  sorted.forEach(t => curve.push(+(curve[curve.length-1]+(t.pnl||0)).toFixed(2)))
  if (curve.length < 2) return (
    <div style={{ height:110, display:'flex', alignItems:'center', justifyContent:'center', color:T.d, fontSize:13, flexDirection:'column', gap:6 }}>
      <span style={{ fontSize:28 }}>📈</span>Log trades to build your equity curve
    </div>
  )
  const W=540,H=110,P=14,min=Math.min(...curve),max=Math.max(...curve),range=max-min||1
  const sx=i=>P+(i/(curve.length-1))*(W-P*2), sy=v=>H-P-((v-min)/range)*(H-P*2)
  const line=curve.map((v,i)=>`${i===0?'M':'L'}${sx(i)},${sy(v)}`).join(' ')
  const area=`${line} L${sx(curve.length-1)},${H} L${sx(0)},${H} Z`
  const ret=+(((curve[curve.length-1]-BASE)/BASE)*100).toFixed(2), isUp=ret>=0
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, alignItems:'center' }}>
        <span style={{ fontSize:11, color:T.d }}>Starting ₹{(BASE/1000).toFixed(0)}K</span>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <span style={{ fontSize:12, color:T.m }}>{curve.length-1} trades</span>
          <span style={{ fontSize:14, fontWeight:800, color:isUp?T.g:T.r, fontFamily:T.mono }}>
            {isUp?'+':''}{ret}%
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto' }}>
        <defs>
          <linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={isUp?T.g:T.r} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={isUp?T.g:T.r} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={area} fill="url(#eqg)"/>
        <path d={line} fill="none" stroke={isUp?T.g:T.r} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={sx(curve.length-1)} cy={sy(curve[curve.length-1])} r="4.5" fill={isUp?T.g:T.r}/>
        <circle cx={sx(curve.length-1)} cy={sy(curve[curve.length-1])} r="9" fill={isUp?T.g:T.r} fillOpacity="0.18"/>
      </svg>
    </div>
  )
}

function AllocDonut({ holdings }) {
  const R=48,cx=65,cy=65,stroke=15,circ=2*Math.PI*R
  const g={},COLORS={Equities:T.p,Options:'#9B59B6',Forex:'#C084FC',Other:T.d}
  let total=0
  holdings.forEach(h=>{
    const k=h.exchange==='MT5'||h.exchange==='FOREX'?'Forex':h.exchange==='OPT'?'Options':'Equities'
    const v=(h.qty||0)*(h.avg_price||0); g[k]=(g[k]||0)+v; total+=v
  })
  const alloc=total>0?Object.entries(g).map(([l,v])=>({l,pct:+(v/total*100).toFixed(1),color:COLORS[l]||T.d})):[{l:'Empty',pct:100,color:T.f}]
  let offset=0
  const tf=total>0?(total>=1e5?`₹${(total/1e5).toFixed(1)}L`:`₹${total.toLocaleString('en-IN',{maximumFractionDigits:0})}`):'—'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:18 }}>
      <svg viewBox="0 0 130 130" style={{ width:115, height:115, flexShrink:0 }}>
        {alloc.map(s=>{const d=(s.pct/100)*circ;const el=<circle key={s.l} cx={cx} cy={cy} r={R} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${d} ${circ-d}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`}/>;offset+=d;return el})}
        <text x={cx} y={cy-4}  textAnchor="middle" fill="#fff"  fontSize="12" fontWeight="800">{tf}</text>
        <text x={cx} y={cy+11} textAnchor="middle" fill={T.d} fontSize="8">Portfolio</text>
      </svg>
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {total===0 ? <span style={{ fontSize:12, color:T.d }}>Add holdings</span> : alloc.map(a=>(
          <div key={a.l} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8,height:8,borderRadius:3,background:a.color,flexShrink:0 }}/>
            <span style={{ fontSize:12, color:T.m }}>{a.l}</span>
            <span style={{ fontSize:12, fontWeight:700, color:'#fff', marginLeft:'auto', paddingLeft:10, fontFamily:T.mono }}>{a.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, sub, color, trend }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'16px 18px', transition:'border-color 0.2s' }}
      onMouseEnter={e=>e.currentTarget.style.borderColor=T.borderHi}
      onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
      <p style={{ margin:'0 0 4px', fontSize:10, color:T.d, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700 }}>{label}</p>
      <p style={{ margin:'0 0 3px', fontSize:22, fontWeight:800, color:color||'#fff', letterSpacing:'-0.02em', fontFamily:T.mono }}>{value}</p>
      {sub && <p style={{ margin:0, fontSize:11, color:T.d }}>{sub}</p>}
    </div>
  )
}

/* ── TRADE MODAL ── */
function TradeModal({ initial, onSave, onClose }) {
  const E = { symbol:'',type:'LONG',entry:'',exit:'',qty:'',pnl:'',date:new Date().toISOString().slice(0,10),emotion:'😊',discipline:80,setup:'',notes:'',image_url:'' }
  const [form,setForm]=useState(initial||E)
  const [imgFile,setImg]=useState(null),[preview,setPrev]=useState(initial?.image_url||'')
  const [up,setUp]=useState(false),[sav,setSav]=useState(false)
  const fileRef=useRef()
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const onFile=e=>{const f=e.target.files?.[0];if(!f)return;setImg(f);setPrev(URL.createObjectURL(f))}
  const handleSave=async()=>{
    if(!form.symbol)return;setSav(true)
    try{
      let image_url=form.image_url
      if(imgFile){setUp(true);const r=await uploadImage(imgFile);image_url=r.url;setUp(false)}
      let pnl=parseFloat(form.pnl)
      if(!pnl&&form.entry&&form.exit&&form.qty){
        const diff=form.type==='LONG'?(+form.exit-+form.entry):(+form.entry-+form.exit)
        pnl=+(diff*+form.qty).toFixed(2)
      }
      await onSave({...form,entry:+form.entry,exit:+form.exit||null,qty:+form.qty,pnl,image_url})
    }finally{setSav(false)}
  }

  const inp=(label,name,type='text',ph='')=>(
    <div>
      <label style={{ display:'block',fontSize:10,fontWeight:700,color:T.d,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.07em' }}>{label}</label>
      <input name={name} type={type} value={form[name]??''} onChange={e=>set(name,e.target.value)} placeholder={ph}
        style={{ width:'100%',padding:'9px 12px',background:'rgba(255,255,255,0.06)',border:`1px solid ${T.border}`,borderRadius:9,color:'#fff',fontSize:13,outline:'none',fontFamily:T.font,boxSizing:'border-box',transition:'border-color 0.15s' }}
        onFocus={e=>e.target.style.borderColor=T.p} onBlur={e=>e.target.style.borderColor=T.border}/>
    </div>
  )

  return (
    <div style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24 }} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{ background:'#0d0a18',border:`1px solid rgba(91,46,255,0.3)`,borderRadius:20,padding:'24px 26px',width:'100%',maxWidth:500,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 8px 48px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
          <h3 style={{ margin:0,fontSize:15,fontWeight:800 }}>{initial?'Edit Trade':'Log New Trade'}</h3>
          <button onClick={onClose} style={{ background:'none',border:`1px solid ${T.border}`,borderRadius:7,color:T.m,fontSize:14,cursor:'pointer',padding:'4px 10px' }}>✕</button>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 130px',gap:10 }}>
            {inp('Symbol','symbol','text','RELIANCE, XAUUSD…')}
            <div>
              <label style={{ display:'block',fontSize:10,fontWeight:700,color:T.d,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.07em' }}>Type</label>
              <div style={{ display:'flex',gap:5 }}>
                {['LONG','SHORT'].map(t=>(
                  <button key={t} onClick={()=>set('type',t)} style={{ flex:1,padding:'9px 0',border:'none',borderRadius:9,fontFamily:T.font,fontSize:12,fontWeight:700,cursor:'pointer',transition:'all 0.15s',background:form.type===t?(t==='LONG'?'rgba(46,204,138,0.2)':'rgba(255,77,106,0.2)'):'rgba(255,255,255,0.05)',color:form.type===t?(t==='LONG'?T.g:T.r):T.m }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10 }}>
            {inp('Entry ₹','entry','number','0.00')}{inp('Exit ₹','exit','number','0.00')}{inp('Qty','qty','number','1')}
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
            {inp('Date','date','date')}{inp('Setup','setup','text','Breakout, Pullback…')}
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
            <div>
              <label style={{ display:'block',fontSize:10,fontWeight:700,color:T.d,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.07em' }}>Emotion</label>
              <div style={{ display:'flex',gap:5 }}>
                {['😊','😐','😤','😰','🤑'].map(e=>(
                  <button key={e} onClick={()=>set('emotion',e)} style={{ flex:1,padding:'7px 0',border:`1px solid ${form.emotion===e?T.p:T.border}`,borderRadius:8,background:form.emotion===e?T.pd:'rgba(255,255,255,0.03)',fontSize:15,cursor:'pointer',transition:'all 0.15s' }}>{e}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display:'block',fontSize:10,fontWeight:700,color:T.d,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.07em' }}>Discipline: {form.discipline}/100</label>
              <input type="range" min="0" max="100" value={form.discipline} onChange={e=>set('discipline',+e.target.value)} style={{ width:'100%',accentColor:T.p,marginTop:10 }}/>
            </div>
          </div>
          <div>
            <label style={{ display:'block',fontSize:10,fontWeight:700,color:T.d,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.07em' }}>Notes</label>
            <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="What happened? Why did you take this trade? What would you do differently?" rows={3}
              style={{ width:'100%',padding:'9px 12px',background:'rgba(255,255,255,0.06)',border:`1px solid ${T.border}`,borderRadius:9,color:'#fff',fontSize:13,outline:'none',fontFamily:T.font,resize:'vertical',boxSizing:'border-box' }}
              onFocus={e=>e.target.style.borderColor=T.p} onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          {/* Image upload */}
          <div>
            <label style={{ display:'block',fontSize:10,fontWeight:700,color:T.d,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.07em' }}>Chart Screenshot</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display:'none' }}/>
            {preview ? (
              <div style={{ position:'relative',borderRadius:9,overflow:'hidden',border:`1px solid ${T.border}` }}>
                <img src={preview} alt="" style={{ width:'100%',maxHeight:180,objectFit:'cover',display:'block' }}/>
                <button onClick={()=>{setImg(null);setPrev('');set('image_url','')}} style={{ position:'absolute',top:7,right:7,background:'rgba(0,0,0,0.75)',border:'none',borderRadius:6,color:'#fff',padding:'4px 10px',cursor:'pointer',fontSize:11 }}>✕ Remove</button>
              </div>
            ) : (
              <div onClick={()=>fileRef.current?.click()} style={{ border:`2px dashed ${T.border}`,borderRadius:11,padding:'20px 0',textAlign:'center',cursor:'pointer',transition:'border-color 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=T.p} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                <div style={{ fontSize:22,marginBottom:4 }}>📸</div>
                <div style={{ fontSize:12,color:T.d }}>Click to upload · PNG/JPG · max 5MB · stored in R2</div>
              </div>
            )}
          </div>
          <button onClick={handleSave} disabled={sav||up||!form.symbol} style={{ marginTop:4,padding:'12px 0',border:'none',borderRadius:11,background:!form.symbol?'rgba(91,46,255,0.3)':T.p,color:'#fff',fontSize:14,fontWeight:700,cursor:!form.symbol?'not-allowed':'pointer',fontFamily:T.font,boxShadow:!form.symbol?'none':'0 2px 14px rgba(91,46,255,0.35)' }}>
            {up?'📤 Uploading image…':sav?'Saving…':initial?'Save Changes':'+ Log Trade'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── DASHBOARD HOME ── */
function DashboardHome({ trades, holdings, user }) {
  const totalPnL = trades.reduce((s,t)=>s+(t.pnl||0),0)
  const wins     = trades.filter(t=>t.pnl>0).length
  const winRate  = trades.length>0 ? Math.round(wins/trades.length*100) : 0
  const avgDisc  = trades.length>0 ? Math.round(trades.reduce((s,t)=>s+(t.discipline||70),0)/trades.length) : 0
  const totalVal = holdings.reduce((s,h)=>s+(h.qty||0)*(h.avg_price||0),0)
  const hour     = new Date().getHours()
  const greeting = hour<12?'Good morning':hour<17?'Good afternoon':'Good evening'
  const firstName= (user?.name||'Trader').split(' ')[0]

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22 }}>
        <div>
          <h1 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800,letterSpacing:'-0.02em' }}>
            {hour<12?'Good morning':hour<17?'Good afternoon':'Good evening'}, {firstName} 👋
          </h1>
          <p style={{ margin:0,fontSize:13,color:T.m }}>
            {new Date().toLocaleDateString('en-IN',{weekday:'long',month:'long',day:'numeric'})}
            <span style={{ marginLeft:10,color:T.d }}>·</span>
            <span style={{ marginLeft:10,color:T.d }}>{trades.length} trades logged</span>
          </p>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:8,padding:'9px 14px',background:T.pd,border:'1px solid rgba(91,46,255,0.3)',borderRadius:12,fontSize:12 }}>
          <span style={{ width:7,height:7,borderRadius:'50%',background:T.g,display:'inline-block' }}/>
          Cloudflare D1 Connected
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20 }}>
        <Stat label="Portfolio Value"  value={totalVal>0?fmtInr(totalVal,true):'—'} sub={`${holdings.length} positions`}/>
        <Stat label="Total PnL"        value={fmtInr(totalPnL,true)} sub={`${trades.length} trades`} color={totalPnL>=0?T.g:T.r}/>
        <Stat label="Win Rate"         value={`${winRate}%`} sub={`${wins}W ${trades.length-wins}L`} color={winRate>=60?T.g:T.a}/>
        <Stat label="Avg Discipline"   value={`${avgDisc}/100`} sub="Journal score" color="#C084FC"/>
      </div>

      {/* Charts row */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 300px',gap:14,marginBottom:20 }}>
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:'18px 20px' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
            <h3 style={{ margin:0,fontSize:12,fontWeight:700,color:T.d,textTransform:'uppercase',letterSpacing:'0.07em' }}>Equity Curve</h3>
            <span style={{ fontSize:11,color:T.d }}>Based on trade PnL</span>
          </div>
          <EquityChart trades={trades}/>
        </div>
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:'18px 20px' }}>
          <h3 style={{ margin:'0 0 14px',fontSize:12,fontWeight:700,color:T.d,textTransform:'uppercase',letterSpacing:'0.07em' }}>Allocation</h3>
          <AllocDonut holdings={holdings}/>
        </div>
      </div>

      {/* Recent trades */}
      {trades.length>0 && (
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:'18px 20px',marginBottom:16 }}>
          <h3 style={{ margin:'0 0 14px',fontSize:12,fontWeight:700,color:T.d,textTransform:'uppercase',letterSpacing:'0.07em' }}>Recent Trades</h3>
          <div style={{ display:'flex',flexDirection:'column',gap:7 }}>
            {trades.slice(0,5).map(t=>(
              <div key={t.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',background:'rgba(255,255,255,0.02)',borderRadius:10,transition:'background 0.12s' }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}>
                <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <span style={{ fontSize:17 }}>{t.emotion}</span>
                  <div>
                    <span style={{ fontWeight:700,fontSize:14 }}>{t.symbol}</span>
                    <span style={{ marginLeft:7,fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,background:t.type==='LONG'?'rgba(46,204,138,0.15)':'rgba(255,77,106,0.15)',color:t.type==='LONG'?T.g:T.r }}>{t.type}</span>
                    {t.setup && <span style={{ marginLeft:7,fontSize:11,color:T.d }}>{t.setup}</span>}
                  </div>
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:14 }}>
                  <span style={{ fontSize:11,color:T.d,fontFamily:T.mono }}>{t.date?.slice(0,10)}</span>
                  <span style={{ fontWeight:800,fontSize:14,color:(t.pnl||0)>=0?T.g:T.r,fontFamily:T.mono }}>{fmtInr(t.pnl)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emotion tracker */}
      {trades.length>0 && (
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:'18px 20px' }}>
          <h3 style={{ margin:'0 0 4px',fontSize:12,fontWeight:700,color:T.d,textTransform:'uppercase',letterSpacing:'0.07em' }}>Emotional Tracker</h3>
          <p style={{ margin:'0 0 12px',fontSize:11,color:'rgba(255,255,255,0.2)' }}>One emoji per trade — spot your behavioral patterns</p>
          <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
            {trades.slice(0,30).map((t,i)=>(
              <div key={i} title={`${t.symbol} · ${t.date?.slice(0,10)} · ${fmtInr(t.pnl)}`} style={{ width:34,height:34,borderRadius:9,fontSize:17,background:'rgba(255,255,255,0.04)',display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${T.f}`,cursor:'default',transition:'transform 0.1s' }}
                onMouseEnter={e=>e.currentTarget.style.transform='scale(1.15)'}
                onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                {t.emotion||'😐'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── JOURNAL ── */
function JournalPage({ trades, onAdd, onDelete }) {
  const [show,setShow]=useState(false),[edit,setEdit]=useState(null)
  const [filter,setFilter]=useState('ALL'),[search,setSearch]=useState(''),[sort,setSort]=useState('date')

  const filtered = trades
    .filter(t=>{if(filter!=='ALL'&&t.type!==filter)return false;if(search&&!t.symbol.toLowerCase().includes(search.toLowerCase()))return false;return true})
    .sort((a,b)=>sort==='pnl'?(b.pnl||0)-(a.pnl||0):sort==='discipline'?(b.discipline||0)-(a.discipline||0):new Date(b.date)-new Date(a.date))

  const totalPnL = filtered.reduce((s,t)=>s+(t.pnl||0),0)

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20 }}>
        <div>
          <h1 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800,letterSpacing:'-0.02em' }}>Trade Journal</h1>
          <p style={{ margin:0,fontSize:13,color:T.m }}>
            {filtered.length} trades · <span style={{ color:filtered.reduce((s,t)=>s+(t.pnl>0?1:0),0)/filtered.length>=0.5?T.g:T.r }}>{filtered.filter(t=>t.pnl>0).length}W {filtered.filter(t=>t.pnl<0).length}L</span> ·
            <span style={{ color:totalPnL>=0?T.g:T.r, fontFamily:T.mono, marginLeft:4 }}>{fmtInr(totalPnL)}</span>
          </p>
        </div>
        <button onClick={()=>{setEdit(null);setShow(true)}} style={{ padding:'10px 20px',background:T.p,border:'none',borderRadius:12,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:T.font,boxShadow:'0 2px 14px rgba(91,46,255,0.35)' }}>+ Log Trade</button>
      </div>

      <div style={{ display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search symbol…"
          style={{ padding:'8px 12px',background:T.card,border:`1px solid ${T.border}`,borderRadius:9,color:'#fff',fontSize:13,outline:'none',fontFamily:T.font,width:160 }}
          onFocus={e=>e.target.style.borderColor=T.p} onBlur={e=>e.target.style.borderColor=T.border}/>
        <div style={{ display:'flex',gap:4 }}>
          {['ALL','LONG','SHORT'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:'7px 13px',borderRadius:9,fontFamily:T.font,background:filter===f?T.p:T.card,color:filter===f?'#fff':T.m,fontSize:12,fontWeight:filter===f?700:400,cursor:'pointer',border:`1px solid ${filter===f?'transparent':T.border}` }}>{f}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto',display:'flex',gap:4,alignItems:'center' }}>
          <span style={{ fontSize:11,color:T.d }}>Sort:</span>
          {[['date','Date'],['pnl','P&L'],['discipline','Disc']].map(([v,l])=>(
            <button key={v} onClick={()=>setSort(v)} style={{ padding:'6px 11px',borderRadius:8,fontFamily:T.font,background:sort===v?T.pd:T.card,color:sort===v?'rgba(255,255,255,0.9)':T.d,fontSize:11,fontWeight:sort===v?700:400,cursor:'pointer',border:`1px solid ${sort===v?'rgba(91,46,255,0.35)':T.border}` }}>{l}</button>
          ))}
        </div>
      </div>

      {filtered.length===0 ? (
        <div style={{ textAlign:'center',padding:'80px 0',color:T.m }}>
          <div style={{ fontSize:40,marginBottom:12 }}>📋</div>
          <div style={{ fontSize:15 }}>No trades yet</div>
          <div style={{ fontSize:12,color:T.d,marginTop:4 }}>Click "+ Log Trade" to start your journal</div>
        </div>
      ) : (
        <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
          {filtered.map(t=><TradeCard key={t.id} trade={t} onEdit={()=>{setEdit(t);setShow(true)}} onDelete={()=>onDelete(t.id)}/>)}
        </div>
      )}
      {show && <TradeModal initial={edit} onClose={()=>{setShow(false);setEdit(null)}} onSave={async d=>{await onAdd(d,edit?.id);setShow(false);setEdit(null)}}/>}
    </div>
  )
}

function TradeCard({ trade:t, onEdit, onDelete }) {
  const [open,setOpen]=useState(false)
  const profitPct = t.entry ? +((((t.exit||t.entry)-t.entry)/(t.entry)*(t.type==='SHORT'?-1:1))*100).toFixed(2) : null
  return (
    <div style={{ background:T.card,border:`1px solid ${open?T.p+'44':T.border}`,borderRadius:14,overflow:'hidden',transition:'border-color 0.15s' }}>
      <div style={{ padding:'13px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer' }} onClick={()=>setOpen(!open)}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <span style={{ fontSize:18 }}>{t.emotion}</span>
          <div>
            <span style={{ fontWeight:700,fontSize:14 }}>{t.symbol}</span>
            <span style={{ marginLeft:7,fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,background:t.type==='LONG'?'rgba(46,204,138,0.15)':'rgba(255,77,106,0.15)',color:t.type==='LONG'?T.g:T.r }}>{t.type}</span>
            {t.setup && <span style={{ marginLeft:7,fontSize:11,color:T.d,padding:'2px 6px',background:T.f,borderRadius:5 }}>{t.setup}</span>}
          </div>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:16 }}>
          <span style={{ fontSize:11,color:T.d,fontFamily:T.mono }}>{t.date?.slice(0,10)}</span>
          {t.image_url && <span style={{ fontSize:11,color:'#C084FC',background:'rgba(192,132,252,0.1)',padding:'2px 6px',borderRadius:5 }}>📸</span>}
          <div style={{ textAlign:'right' }}>
            <div style={{ fontWeight:800,fontSize:14,color:(t.pnl||0)>=0?T.g:T.r,fontFamily:T.mono }}>{fmtInr(t.pnl)}</div>
            {profitPct!==null && <div style={{ fontSize:10,color:(t.pnl||0)>=0?T.g:T.r,fontFamily:T.mono }}>{profitPct>=0?'+':''}{profitPct}%</div>}
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:10,color:T.d,marginBottom:2 }}>Disc.</div>
            <div style={{ fontSize:12,fontWeight:700,color:t.discipline>=80?T.g:t.discipline>=60?T.a:T.r }}>{t.discipline}/100</div>
          </div>
          <span style={{ color:T.d,fontSize:11 }}>{open?'▲':'▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ borderTop:`1px solid ${T.f}`,padding:'13px 16px' }}>
          {t.image_url && <div style={{ marginBottom:12,borderRadius:9,overflow:'hidden',border:`1px solid ${T.border}` }}><img src={t.image_url} alt="" style={{ width:'100%',maxHeight:200,objectFit:'cover',display:'block' }}/></div>}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:10 }}>
            {[['Entry',t.entry?`₹${(+t.entry).toLocaleString('en-IN')}`:'—'],['Exit',t.exit?`₹${(+t.exit).toLocaleString('en-IN')}`:'Open'],['Qty',t.qty],['Date',t.date?.slice(0,10)]].map(([l,v])=>(
              <div key={l}><p style={{ margin:'0 0 2px',fontSize:10,color:T.d,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700 }}>{l}</p><p style={{ margin:0,fontSize:13,fontWeight:600,fontFamily:T.mono }}>{v}</p></div>
            ))}
          </div>
          {t.notes && <div style={{ marginBottom:10,padding:'10px 12px',background:'rgba(91,46,255,0.07)',borderRadius:9,border:'1px solid rgba(91,46,255,0.15)',fontSize:13,color:T.m,lineHeight:1.65,borderLeft:`3px solid rgba(91,46,255,0.4)` }}>{t.notes}</div>}
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
            <button onClick={onEdit} style={{ padding:'6px 14px',background:T.pd,border:'1px solid rgba(91,46,255,0.3)',borderRadius:8,color:'#fff',fontSize:12,cursor:'pointer',fontFamily:T.font }}>Edit</button>
            <button onClick={onDelete} style={{ padding:'6px 14px',background:'rgba(255,77,106,0.1)',border:'1px solid rgba(255,77,106,0.2)',borderRadius:8,color:T.r,fontSize:12,cursor:'pointer',fontFamily:T.font }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── HOLDINGS ── */
function HoldingsPage({ holdings, onRefresh }) {
  const [showAdd,setShowAdd]=useState(false),[form,setForm]=useState({symbol:'',qty:'',avg_price:'',sector:'',exchange:'NSE'})
  const [saving,setSaving]=useState(false),[syncing,setSyncing]=useState(null),[msg,setMsg]=useState(null)
  const [mt5Status,setMt5Status]=useState(null)

  useEffect(()=>{ getMt5Status().then(s=>setMt5Status(s)).catch(()=>{}) },[])

  const syncDhan=async()=>{
    setSyncing('dhan');setMsg(null)
    try{
      const data=await getDhanHoldings()
      const list=Array.isArray(data)?data:(data.data||[])
      if(!list.length){setMsg({t:'w',txt:'No holdings found in Dhan.'});return}
      await clearHoldings()
      for(const h of list){await createHolding({symbol:h.tradingSymbol||h.symbol,qty:h.totalQty||h.quantity||1,avg_price:h.avgCostPrice||h.averagePrice||0,sector:h.sectorName||'',exchange:'NSE'})}
      setMsg({t:'ok',txt:`✅ Synced ${list.length} holdings from Dhan`});onRefresh()
    }catch(e){setMsg({t:'err',txt:e.message.includes('not connected')?'❌ Dhan not connected. Go to Settings → Brokers first.':('❌ '+e.message)})}
    finally{setSyncing(null)}
  }
  const syncMt5=async()=>{
    setSyncing('mt5');setMsg(null)
    try{
      const data=await getMt5Positions()
      if(!data.connected){setMsg({t:'w',txt:'⚠ MT5 not connected. Go to Settings → Brokers to connect your account.'});return}
      const pos=data.positions||[]
      if(!pos.length){setMsg({t:'w',txt:'✓ MT5 connected but no open positions right now.'});return}
      for(const p of pos){
        await createHolding({
          symbol:p.symbol,qty:p.volume,avg_price:p.openPrice,
          ltp:p.currentPrice||p.openPrice,pnl:p.profit||0,
          sector:'Forex/Commodity',exchange:'MT5'
        })
      }
      const bal=data.balance?`Balance: ${data.currency||'$'}${(+data.balance).toFixed(2)}`:''
      setMsg({t:'ok',txt:`✅ Synced ${pos.length} MT5 position(s). ${bal}`})
      onRefresh()
    }catch(e){setMsg({t:'err',txt:`❌ ${e.message}`})}
    finally{setSyncing(null)}
  }

  const handleAdd=async()=>{
    if(!form.symbol||!form.qty||!form.avg_price)return;setSaving(true)
    try{await createHolding({...form,qty:+form.qty,avg_price:+form.avg_price});setForm({symbol:'',qty:'',avg_price:'',sector:'',exchange:'NSE'});setShowAdd(false);onRefresh()}finally{setSaving(false)}
  }

  const totalVal = holdings.reduce((s,h)=>s+(h.qty||0)*(h.avg_price||0),0)
  const msgStyle = { ok:'rgba(46,204,138,0.08)', w:'rgba(245,166,35,0.08)', err:'rgba(255,77,106,0.08)' }
  const msgBorder = { ok:'rgba(46,204,138,0.25)', w:'rgba(245,166,35,0.25)', err:'rgba(255,77,106,0.25)' }

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
        <div>
          <h1 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800,letterSpacing:'-0.02em' }}>Holdings</h1>
          <p style={{ margin:0,fontSize:13,color:T.m }}>{holdings.length} positions · Cost {fmtInr(totalVal,true)}</p>
        </div>
        <button onClick={()=>setShowAdd(!showAdd)} style={{ padding:'10px 18px',background:T.p,border:'none',borderRadius:12,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:T.font }}>+ Add</button>
      </div>

      {/* Broker sync cards */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:18 }}>
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:'16px 18px' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:700,fontSize:14,marginBottom:3 }}>🏦 Dhan — NSE/BSE</div>
              <div style={{ fontSize:11,color:T.d }}>Configure in Settings → Brokers</div>
            </div>
            <button onClick={syncDhan} disabled={!!syncing} style={{ padding:'8px 16px',background:syncing==='dhan'?'rgba(91,46,255,0.4)':T.p,border:'none',borderRadius:9,color:'#fff',fontSize:12,fontWeight:700,cursor:syncing?'not-allowed':'pointer',fontFamily:T.font }}>
              {syncing==='dhan'?'⟳ Syncing…':'⟳ Sync Holdings'}
            </button>
          </div>
        </div>
        <div style={{ background:T.card,border:`1px solid ${mt5Status?.connected?'rgba(46,204,138,0.3)':T.border}`,borderRadius:16,padding:'16px 18px' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
            <div>
              <div style={{ fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:8 }}>
                📈 MetaTrader 5
                {mt5Status?.connected&&<span style={{ fontSize:10,color:T.g,background:'rgba(46,204,138,0.1)',padding:'1px 7px',borderRadius:999 }}>● Connected</span>}
                {!mt5Status?.connected&&<span style={{ fontSize:10,color:T.d }}>Not connected</span>}
              </div>
              <div style={{ fontSize:11,color:T.d }}>
                {mt5Status?.connected?`${mt5Status.login||''}@${mt5Status.server||''} · Balance: ${mt5Status.currency||'$'}${mt5Status.balance?.toFixed(2)||'—'}`:'Connect in Settings → Brokers'}
              </div>
            </div>
            <button onClick={syncMt5} disabled={!!syncing||!mt5Status?.connected}
              style={{ padding:'7px 14px',background:!mt5Status?.connected?'rgba(255,255,255,0.04)':syncing==='mt5'?'rgba(46,204,138,0.3)':T.g,border:`1px solid ${!mt5Status?.connected?T.border:'transparent'}`,borderRadius:10,color:!mt5Status?.connected?T.d:'#fff',fontSize:12,fontWeight:700,cursor:(syncing||!mt5Status?.connected)?'not-allowed':'pointer',fontFamily:T.font }}>
              {syncing==='mt5'?'Syncing…':'⟳ Sync Positions'}
            </button>
          </div>
        </div>
      </div>

      {msg && <div style={{ padding:'10px 14px',background:msgStyle[msg.t],border:`1px solid ${msgBorder[msg.t]}`,borderRadius:11,fontSize:13,color:'#fff',marginBottom:14 }}>{msg.txt}</div>}

      {showAdd && (
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:'16px 18px',marginBottom:16 }}>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:9,marginBottom:9 }}>
            {[['Symbol','symbol','RELIANCE'],['Qty','qty','10'],['Avg Price','avg_price','2800'],['Sector','sector','IT']].map(([l,k,ph])=>(
              <div key={k}>
                <label style={{ display:'block',fontSize:10,fontWeight:700,color:T.d,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.07em' }}>{l}</label>
                <input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={ph}
                  style={{ width:'100%',padding:'8px 10px',background:'rgba(255,255,255,0.06)',border:`1px solid ${T.border}`,borderRadius:9,color:'#fff',fontSize:13,outline:'none',fontFamily:T.font,boxSizing:'border-box' }}
                  onFocus={e=>e.target.style.borderColor=T.p} onBlur={e=>e.target.style.borderColor=T.border}/>
              </div>
            ))}
            <div style={{ display:'flex',alignItems:'flex-end' }}>
              <button onClick={handleAdd} disabled={saving} style={{ width:'100%',padding:'8px 0',background:T.p,border:'none',borderRadius:9,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:T.font }}>
                {saving?'…':'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {holdings.length===0 ? (
        <div style={{ textAlign:'center',padding:'70px 0',color:T.m }}>
          <div style={{ fontSize:36,marginBottom:12 }}>💼</div>
          <div style={{ fontSize:15 }}>No holdings yet</div>
          <div style={{ fontSize:12,color:T.d,marginTop:4 }}>Sync from Dhan/MT5 or add manually above</div>
        </div>
      ) : (
        <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,overflow:'hidden' }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                {['Symbol','Exchange','Sector','Qty','Avg Price',''].map(h=>(
                  <th key={h} style={{ padding:'10px 14px',fontSize:10,fontWeight:700,color:T.d,textTransform:'uppercase',letterSpacing:'0.07em',textAlign:h===''?'right':'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holdings.map(h=>(
                <tr key={h.id} style={{ borderBottom:`1px solid ${T.f}`,transition:'background 0.1s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'11px 14px',fontWeight:700,fontSize:14 }}>{h.symbol}</td>
                  <td style={{ padding:'11px 14px' }}>
                    <span style={{ padding:'2px 8px',borderRadius:6,background:h.exchange==='MT5'?'rgba(46,204,138,0.1)':'rgba(91,46,255,0.1)',color:h.exchange==='MT5'?T.g:'#C084FC',fontSize:11,fontWeight:700 }}>{h.exchange}</span>
                  </td>
                  <td style={{ padding:'11px 14px',fontSize:13,color:T.m }}>{h.sector||'—'}</td>
                  <td style={{ padding:'11px 14px',fontSize:13,fontFamily:T.mono }}>{h.qty}</td>
                  <td style={{ padding:'11px 14px',fontSize:13,fontWeight:600,fontFamily:T.mono }}>₹{(+h.avg_price).toLocaleString('en-IN')}</td>
                  <td style={{ padding:'11px 14px',textAlign:'right' }}>
                    <button onClick={async()=>{await deleteHolding(h.id);onRefresh()}} style={{ padding:'4px 10px',background:'rgba(255,77,106,0.08)',border:'1px solid rgba(255,77,106,0.15)',borderRadius:7,color:T.r,fontSize:11,cursor:'pointer',fontFamily:T.font }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── AI CHAT (Groq — real portfolio data) ── */
function ChatPage({ trades, holdings }) {
  const [messages,setMessages]=useState([{
    role:'assistant',
    text:`Hi! I'm your TradeDaddy AI powered by Groq Llama 3.3 70B.\n\nI have full access to your portfolio:\n• ${holdings.length} holdings\n• ${trades.length} trades logged\n• Total PnL: ${fmtInr(trades.reduce((s,t)=>s+(t.pnl||0),0))}\n• Win rate: ${trades.length>0?Math.round(trades.filter(t=>t.pnl>0).length/trades.length*100):0}%\n\nAsk me anything — from "why am I losing money?" to "how does RBI policy affect my HDFC Bank position?"`
  }])
  const [input,setInput]=useState(''),[loading,setLoading]=useState(false),[liveData,setLiveData]=useState({})
  const bottomRef=useRef()
  const SUGGS=['Why am I losing money on my trades?','Best and worst performing setup?','How does RBI policy affect my portfolio?','What am I doing wrong emotionally?','Give me today\'s briefing in 3 sentences']

  // Fetch live quotes for holdings on mount
  useEffect(()=>{
    if(!holdings.length) return
    Promise.allSettled(holdings.slice(0,8).map(h => getQuote(h.symbol))).then(results=>{
      const data={}
      results.forEach((r,i)=>{ if(r.status==='fulfilled'&&r.value) data[holdings[i].symbol]={price:r.value.price,changePct:r.value.changePct,change:r.value.change} })
      setLiveData(data)
    }).catch(()=>{})
  },[holdings.length])

  const send=async(msg)=>{
    const text=msg||input.trim(); if(!text) return
    setInput('');setMessages(p=>[...p,{role:'user',text}]);setLoading(true)
    try{
      // Build rich portfolio context with live data
      const holdingsWithLive = holdings.slice(0,10).map(h=>{
        const live = liveData[h.symbol]
        return `${h.symbol} (${h.exchange}): ${h.qty} units @ avg ₹${h.avg_price}${live?` | Live: ₹${live.price} | Today: ${live.changePct>=0?'+':''}${live.changePct}%`:''}`
      }).join('\n')

      const tradeHistory = trades.slice(0,20).map(t=>
        `${t.date?.slice(0,10)} | ${t.symbol} | ${t.type} | Entry:${t.entry} Exit:${t.exit||'open'} | PnL:${t.pnl>=0?'+':''}₹${t.pnl} | Setup:${t.setup||'none'} | Disc:${t.discipline}/100 | Emotion:${t.emotion}`
      ).join('\n')

      const setupStats = {}
      trades.forEach(t=>{ if(t.setup){if(!setupStats[t.setup])setupStats[t.setup]={wins:0,total:0,pnl:0};setupStats[t.setup].total++;if(t.pnl>0)setupStats[t.setup].wins++;setupStats[t.setup].pnl+=t.pnl||0}})
      const setupSummary = Object.entries(setupStats).map(([s,d])=>`${s}: ${d.total} trades, ${Math.round(d.wins/d.total*100)}% WR, PnL ₹${d.pnl.toFixed(0)}`).join(' | ')

      const emotionCount = {}
      trades.forEach(t=>{ const e=t.emotion||'😐'; emotionCount[e]=(emotionCount[e]||0)+1 })
      const emotionSummary = Object.entries(emotionCount).sort((a,b)=>b[1]-a[1]).map(([e,n])=>`${e}×${n}`).join(' ')

      const systemContext = `You are TradeDaddy AI — a personalized Indian equity trading assistant with full access to this user's live portfolio and complete trade history.

═══ LIVE PORTFOLIO (${holdings.length} positions) ═══
${holdingsWithLive || 'No holdings yet'}

═══ TRADE HISTORY (last ${Math.min(trades.length,20)} trades) ═══
${tradeHistory || 'No trades logged yet'}

═══ PERFORMANCE ANALYTICS ═══
Total trades: ${trades.length} | Win rate: ${trades.length>0?Math.round(trades.filter(t=>t.pnl>0).length/trades.length*100):0}% | Total P&L: ₹${trades.reduce((s,t)=>s+(t.pnl||0),0).toFixed(0)}
Avg discipline: ${trades.length>0?Math.round(trades.reduce((s,t)=>s+(t.discipline||70),0)/trades.length):0}/100
Setup performance: ${setupSummary || 'no setup data yet'}
Emotional pattern: ${emotionSummary || 'no data'}
Low-discipline trades (<65): ${trades.filter(t=>(t.discipline||70)<65).length}
Repeat loss symbols: ${[...new Set(trades.filter(t=>t.pnl<0).map(t=>t.symbol))].slice(0,4).join(', ')||'none'}

═══ RESPONSE RULES ═══
1. Reference specific trades by date/symbol/price from the history above
2. Calculate stats from real numbers — never estimate
3. For pattern questions: cite actual examples from the trade log
4. Connect macro events to the specific holdings shown with live prices
5. Give actionable guidance with price levels, not vague advice
6. Be direct and analytical — this is a professional trading context`
      const reply = await groqChat(
        [...messages.map(m=>({role:m.role,content:m.text})), {role:'user',content:text}],
        systemContext
      )
      setMessages(p=>[...p,{role:'assistant',text:reply}])
    }catch(e){
      setMessages(p=>[...p,{role:'assistant',text:`Error: ${e.message}`}])
    }finally{
      setLoading(false)
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),100)
    }
  }

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'calc(100vh - 90px)' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
        <div>
          <h1 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800,letterSpacing:'-0.02em' }}>AI Chat</h1>
          <p style={{ margin:0,fontSize:13,color:T.m }}>Groq Llama 3.3 70B · Live portfolio context · {Object.keys(liveData).length} live quotes loaded</p>
        </div>
        {Object.keys(liveData).length > 0 && (
          <div style={{ padding:'6px 12px',background:'rgba(46,204,138,0.08)',border:'1px solid rgba(46,204,138,0.2)',borderRadius:9,fontSize:11,color:T.g }}>
            ✓ Live quotes loaded
          </div>
        )}
      </div>

      <div style={{ display:'flex',gap:7,flexWrap:'wrap',marginBottom:14 }}>
        {SUGGS.map(s=>(
          <button key={s} onClick={()=>send(s)} style={{ padding:'6px 12px',border:`1px solid ${T.border}`,borderRadius:999,background:T.card,color:T.m,fontSize:12,cursor:'pointer',fontFamily:T.font,transition:'all 0.15s' }}
            onMouseEnter={e=>{e.target.style.borderColor=T.p;e.target.style.color='#fff'}}
            onMouseLeave={e=>{e.target.style.borderColor=T.border;e.target.style.color=T.m}}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:12,paddingRight:4,marginBottom:12 }}>
        {messages.map((m,i)=>(
          <div key={i} style={{ display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            {m.role==='assistant' && <div style={{ width:28,height:28,borderRadius:'50%',background:T.p,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,marginRight:8,flexShrink:0,alignSelf:'flex-start',marginTop:4 }}>🤖</div>}
            <div style={{ maxWidth:'76%',padding:'12px 16px',borderRadius:m.role==='user'?'16px 16px 4px 16px':'4px 16px 16px 16px',background:m.role==='user'?'rgba(91,46,255,0.25)':T.card,border:`1px solid ${m.role==='user'?'rgba(91,46,255,0.4)':T.border}`,fontSize:14,lineHeight:1.75,color:T.t,whiteSpace:'pre-wrap' }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:28,height:28,borderRadius:'50%',background:T.p,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13 }}>🤖</div>
            <div style={{ padding:'12px 16px',borderRadius:'4px 16px 16px 16px',background:T.card,border:`1px solid ${T.border}`,fontSize:14,color:T.d }}>
              Thinking with your portfolio data…
              <span style={{ display:'inline-block',animation:'pulse 1s infinite',marginLeft:4 }}>●</span>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      <div style={{ display:'flex',gap:10 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
          placeholder="Ask about your portfolio, trading patterns, market conditions…"
          style={{ flex:1,padding:'12px 16px',background:T.card,border:`1px solid ${T.border}`,borderRadius:14,color:'#fff',fontSize:14,outline:'none',fontFamily:T.font,transition:'border-color 0.15s' }}
          onFocus={e=>e.target.style.borderColor=T.p} onBlur={e=>e.target.style.borderColor=T.border}/>
        <button onClick={()=>send()} disabled={loading||!input.trim()} style={{ padding:'12px 22px',background:T.p,border:'none',borderRadius:14,color:'#fff',fontSize:16,fontWeight:700,cursor:'pointer',opacity:loading||!input.trim()?0.5:1,boxShadow:'0 2px 14px rgba(91,46,255,0.3)' }}>↑</button>
      </div>
    </div>
  )
}

/* ── MT5 Settings Card — Login + Password via MetaApi ── */
function Mt5SettingsCard() {
  const [form,      setForm]      = useState({ login:'', password:'', server:'', metaapiToken:'' })
  const [status,    setStatus]    = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState(null)
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    getMt5Status().then(s => setStatus(s)).catch(() => {})
  }, [])

  const connect = async () => {
    if (!form.login || !form.password || !form.server) {
      setMsg({ t:'err', txt:'Login, password, and server name are all required.' }); return
    }
    setSaving(true); setMsg(null)
    try {
      setMsg({ t:'info', txt:'⏳ Connecting to MT5 via MetaApi… this takes up to 30 seconds on first connect.' })
      const res = await connectMt5(form.login, form.password, form.server, form.metaapiToken||undefined)
      setStatus({ connected:true, login:res.login, server:res.server })
      setMsg({ t:'ok', txt:`✅ MT5 connected! Account ${res.login}@${res.server}. Go to Holdings → Sync Positions.` })
      setForm({ login:'', password:'', server:'', metaapiToken:'' })
    } catch(e) {
      setMsg({ t:'err', txt:`❌ ${e.message}` })
    } finally { setSaving(false) }
  }

  const disconnect = async () => {
    await disconnectMt5().catch(() => {})
    setStatus({ connected:false }); setMsg({ t:'ok', txt:'MT5 disconnected.' })
  }

  const msgColors = {
    ok:   { bg:'rgba(46,204,138,0.08)',  border:'rgba(46,204,138,0.25)',  color:T.g },
    err:  { bg:'rgba(255,77,106,0.08)', border:'rgba(255,77,106,0.25)', color:T.r },
    info: { bg:'rgba(91,46,255,0.08)',  border:'rgba(91,46,255,0.25)',  color:'rgba(255,255,255,0.7)' },
  }

  const inp = (label, key, type='text', ph='') => (
    <div>
      <label style={{ display:'block', fontSize:10, fontWeight:700, color:T.d, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</label>
      <input type={type} value={form[key]} placeholder={ph}
        onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
        style={{ width:'100%', padding:'10px 12px', background:'rgba(255,255,255,0.06)', border:`1px solid ${T.border}`, borderRadius:9, color:'#fff', fontSize:13, outline:'none', fontFamily:T.mono, boxSizing:'border-box' }}
        onFocus={e => e.target.style.borderColor = T.p}
        onBlur={e => e.target.style.borderColor = T.border}
      />
    </div>
  )

  return (
    <div style={{ background:T.card, border:`1px solid ${status?.connected?'rgba(46,204,138,0.3)':T.border}`, borderRadius:16, padding:'20px 22px', marginBottom:18, maxWidth:520 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, display:'flex', alignItems:'center', gap:10 }}>
            📈 MetaTrader 5
            {status?.connected && (
              <span style={{ fontSize:11, color:T.g, fontWeight:600, padding:'2px 9px', background:'rgba(46,204,138,0.1)', borderRadius:999 }}>● Connected</span>
            )}
          </div>
          <div style={{ fontSize:12, color:T.d, marginTop:3 }}>
            {status?.connected
              ? `${status.login} @ ${status.server}`
              : 'Enter your MT5 login credentials — no script or desktop app needed'}
          </div>
        </div>
        {status?.connected && (
          <button onClick={disconnect} style={{ padding:'6px 13px', background:'rgba(255,77,106,0.1)', border:'1px solid rgba(255,77,106,0.2)', borderRadius:8, color:T.r, fontSize:12, cursor:'pointer', fontFamily:T.font }}>
            Disconnect
          </button>
        )}
      </div>

      {!status?.connected && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {inp('MT5 Login (Account Number)', 'login', 'text', '12345678')}
            {inp('Password', 'password', 'password', '••••••••')}
          </div>
          {inp('Server Name', 'server', 'text', 'Exness-MT5Real, ICMarkets-MT5, XM.COM-MT5Live...')}

          {/* MetaApi token */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
              <label style={{ fontSize:10, fontWeight:700, color:T.d, textTransform:'uppercase', letterSpacing:'0.07em' }}>MetaApi Token (optional but recommended)</label>
              <button onClick={() => setShowToken(v=>!v)} style={{ fontSize:11, color:T.p, background:'none', border:'none', cursor:'pointer', fontFamily:T.font }}>{showToken?'Hide':'What is this?'}</button>
            </div>
            {showToken && (
              <div style={{ marginBottom:8, padding:'10px 12px', background:'rgba(91,46,255,0.07)', border:`1px solid ${T.pd}`, borderRadius:9, fontSize:12, color:T.m, lineHeight:1.6 }}>
                MetaApi is a free service that provides web access to MT5 accounts. Get a free token at{' '}
                <a href="https://app.metaapi.cloud" target="_blank" rel="noopener noreferrer" style={{ color:T.p }}>app.metaapi.cloud</a>{' '}
                → API access tokens. Free tier supports 5 accounts. Without your own token, TradeDaddy uses the shared server token (rate-limited).
              </div>
            )}
            <input type="text" value={form.metaapiToken} placeholder="ey... (optional — uses shared token if blank)"
              onChange={e => setForm(f => ({...f, metaapiToken: e.target.value}))}
              style={{ width:'100%', padding:'10px 12px', background:'rgba(255,255,255,0.06)', border:`1px solid ${T.border}`, borderRadius:9, color:'#fff', fontSize:12, outline:'none', fontFamily:T.mono, boxSizing:'border-box' }}
              onFocus={e => e.target.style.borderColor = T.p}
              onBlur={e => e.target.style.borderColor = T.border}
            />
          </div>

          <button onClick={connect} disabled={saving} style={{ padding:'12px 0', background:saving?'rgba(91,46,255,0.4)':T.p, border:'none', borderRadius:11, color:'#fff', fontSize:14, fontWeight:700, cursor:saving?'not-allowed':'pointer', fontFamily:T.font, opacity:saving?0.8:1, boxShadow:saving?'none':'0 2px 14px rgba(91,46,255,0.35)' }}>
            {saving ? '⏳ Connecting…' : 'Connect MT5'}
          </button>
        </div>
      )}

      {msg && (
        <div style={{ marginTop:12, padding:'10px 13px', background:msgColors[msg.t]?.bg, border:`1px solid ${msgColors[msg.t]?.border}`, borderRadius:10, fontSize:13, color:msgColors[msg.t]?.color, lineHeight:1.5 }}>
          {msg.txt}
        </div>
      )}
    </div>
  )
}


/* ── SETTINGS ── */
function SettingsPage({ onLogout, user }) {
  const [dhanForm,setDhanForm]=useState({clientId:'',accessToken:''})
  const [dhanStat,setDhanStat]=useState(null),[dhanMsg,setDhanMsg]=useState(null),[saving,setSaving]=useState(false)

  useEffect(()=>{ getDhanStatus().then(s=>setDhanStat(s)).catch(()=>{}) },[])

  const connectDhanBroker=async()=>{
    if(!dhanForm.clientId||!dhanForm.accessToken){setDhanMsg({t:'err',txt:'Both fields required'});return}
    setSaving(true);setDhanMsg(null)
    try{
      await connectDhan(dhanForm.clientId,dhanForm.accessToken)
      setDhanMsg({t:'ok',txt:'✅ Dhan connected! Go to Holdings → Sync Holdings.'})
      setDhanStat({connected:true,clientId:`****${dhanForm.clientId.slice(-4)}`})
      setDhanForm({clientId:'',accessToken:''})
    }catch(e){setDhanMsg({t:'err',txt:'❌ '+e.message})}finally{setSaving(false)}
  }

  const inp=(label,name,type='text',ph='',mono=false)=>(
    <div>
      <label style={{ display:'block',fontSize:10,fontWeight:700,color:T.d,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.07em' }}>{label}</label>
      <input type={type} value={dhanForm[name]} onChange={e=>setDhanForm(f=>({...f,[name]:e.target.value}))} placeholder={ph}
        style={{ width:'100%',padding:'10px 12px',background:'rgba(255,255,255,0.06)',border:`1px solid ${T.border}`,borderRadius:9,color:'#fff',fontSize:13,outline:'none',fontFamily:mono?T.mono:T.font,boxSizing:'border-box' }}
        onFocus={e=>e.target.style.borderColor=T.p} onBlur={e=>e.target.style.borderColor=T.border}/>
    </div>
  )

  return (
    <div>
      <h1 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800,letterSpacing:'-0.02em' }}>Settings</h1>
      <p style={{ margin:'0 0 24px',fontSize:13,color:T.m }}>Configure broker connections · Each user has their own isolated credentials</p>

      {/* User info */}
      <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:'18px 20px',marginBottom:18,maxWidth:520 }}>
        <div style={{ display:'flex',alignItems:'center',gap:14 }}>
          <div style={{ width:44,height:44,borderRadius:12,background:`linear-gradient(135deg,${T.p},#9B59B6)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:'#fff' }}>
            {(user?.name||'?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize:15,fontWeight:700 }}>{user?.name||'Trader'}</div>
            <div style={{ fontSize:12,color:T.m }}>{user?.email||''}</div>
          </div>
          <button onClick={onLogout} style={{ marginLeft:'auto',padding:'8px 16px',background:'rgba(255,77,106,0.1)',border:'1px solid rgba(255,77,106,0.25)',borderRadius:9,color:T.r,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:T.font }}>Sign Out</button>
        </div>
      </div>

      {/* Dhan */}
      <div style={{ background:T.card,border:`1px solid ${dhanStat?.connected?'rgba(46,204,138,0.3)':T.border}`,borderRadius:16,padding:'20px 22px',marginBottom:18,maxWidth:520 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
          <div>
            <div style={{ fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:10 }}>
              🏦 Dhan Broker
              {dhanStat?.connected && <span style={{ fontSize:11,color:T.g,fontWeight:600,padding:'2px 9px',background:'rgba(46,204,138,0.1)',borderRadius:999 }}>● Connected {dhanStat.clientId}</span>}
            </div>
            <div style={{ fontSize:12,color:T.d,marginTop:3 }}>
              Get credentials at <a href="https://dhanhq.co" target="_blank" style={{ color:T.p }}>dhanhq.co</a> → API Access · <strong style={{ color:'rgba(255,255,255,0.6)' }}>Your credentials are stored privately, per-user</strong>
            </div>
          </div>
          {dhanStat?.connected && <button onClick={async()=>{await disconnectDhan();setDhanStat({connected:false})}} style={{ padding:'6px 13px',background:'rgba(255,77,106,0.1)',border:'1px solid rgba(255,77,106,0.2)',borderRadius:8,color:T.r,fontSize:12,cursor:'pointer',fontFamily:T.font }}>Disconnect</button>}
        </div>
        {!dhanStat?.connected && (
          <div style={{ display:'flex',flexDirection:'column',gap:11 }}>
            {inp('Client ID','clientId','text','Your Dhan Client ID',true)}
            {inp('Access Token','accessToken','password','Access token from Dhan portal',true)}
            <button onClick={connectDhanBroker} disabled={saving} style={{ padding:'11px 0',background:T.p,border:'none',borderRadius:11,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:T.font,opacity:saving?0.7:1 }}>
              {saving?'Connecting…':'Connect Dhan'}
            </button>
          </div>
        )}
        {dhanMsg && <div style={{ marginTop:11,padding:'9px 13px',background:dhanMsg.t==='ok'?'rgba(46,204,138,0.08)':'rgba(255,77,106,0.08)',border:`1px solid ${dhanMsg.t==='ok'?'rgba(46,204,138,0.25)':'rgba(255,77,106,0.25)'}`,borderRadius:10,fontSize:13 }}>{dhanMsg.txt}</div>}
      </div>

      {/* MT5 — Login + Password */}
      <Mt5SettingsCard/>

      {/* Groq AI */}
      <div style={{ background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:'20px 22px',maxWidth:520 }}>
        <div style={{ fontSize:15,fontWeight:700,marginBottom:8 }}>🤖 AI Configuration — Groq</div>
        <div style={{ fontSize:13,color:T.m,lineHeight:1.7,marginBottom:10 }}>
          TradeDaddy uses <strong style={{ color:'rgba(255,255,255,0.7)' }}>Groq llama-3.3-70b-versatile</strong> for all AI features. It's free for up to 14,400 requests/day.
        </div>
        <div style={{ background:'rgba(255,255,255,0.03)',border:`1px solid ${T.f}`,borderRadius:11,padding:'12px 14px',fontSize:13,color:T.m }}>
          <strong style={{ color:'rgba(255,255,255,0.6)' }}>Setup:</strong> Go to <a href="https://console.groq.com" target="_blank" style={{ color:T.p }}>console.groq.com</a> → API Keys → Create key → run:
          <code style={{ display:'block',marginTop:7,padding:'8px 12px',background:'rgba(255,255,255,0.05)',borderRadius:8,fontSize:12,color:'#C084FC',fontFamily:T.mono }}>
            wrangler secret put GROQ_API_KEY
          </code>
        </div>
      </div>
    </div>
  )
}

/* ── ROOT ── */
export default function Dashboard() {
  const navigate  = useNavigate()
  const [page,     setPage]     = useState('dashboard')
  const [sidebar,  setSidebar]  = useState(true)
  const [trades,   setTrades]   = useState([])
  const [holdings, setHoldings] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  // Always fetch user from server to ensure correct identity after login
  const [user, setUser] = useState(auth.getUser())

  const loadAll = useCallback(async () => {
    setLoading(true)
    try{
      const [t, h, me] = await Promise.all([getTrades(), getHoldings(), getMe()])
      setTrades(t); setHoldings(h); setError(null)
      // Update user from server and persist to localStorage
      if (me && me.id) { auth.setUser(me); setUser(me) }
    }catch(e){ setError(e.message) }finally{ setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [])

  const handleAddTrade = async (data, existingId) => {
    if(existingId){ const u=await updateTrade(existingId,data); setTrades(p=>p.map(t=>t.id===existingId?u:t)) }
    else{ const c=await createTrade(data); setTrades(p=>[c,...p]) }
  }

  const handleLogout = () => { logoutUser(); navigate('/auth') }

  const pages = {
    dashboard: <DashboardHome trades={trades} holdings={holdings} user={user}/>,
    journal:   <JournalPage trades={trades} onAdd={handleAddTrade} onDelete={async id=>{await deleteTrade(id);setTrades(p=>p.filter(t=>t.id!==id))}}/>,
    holdings:  <HoldingsPage holdings={holdings} onRefresh={loadAll}/>,
    scanner:   <Scanner/>,
    analytics: <Analytics trades={trades}/>,
    sectors:   <SectorAnalysis/>,
    news:      <News/>,
    calendar:  <EconomicCalendar/>,
    chat:      <ChatPage trades={trades} holdings={holdings}/>,
    settings:  <SettingsPage onLogout={handleLogout} user={user}/>,
  }

  return (
    <div style={{ display:'flex',minHeight:'100vh',background:T.bg,fontFamily:T.font,color:'#fff' }}>
      {/* Sidebar */}
      <aside style={{ width:sidebar?218:60,flexShrink:0,background:'rgba(255,255,255,0.018)',borderRight:`1px solid ${T.border}`,display:'flex',flexDirection:'column',padding:'22px 0',transition:'width 0.28s cubic-bezier(.4,0,.2,1)',overflow:'hidden',position:'sticky',top:0,height:'100vh' }}>
        {/* Logo */}
        <div style={{ padding:'0 16px 22px',display:'flex',alignItems:'center',gap:10,justifyContent:sidebar?'flex-start':'center' }}>
          <div style={{ width:32,height:32,background:`linear-gradient(135deg,${T.p},#9B59B6)`,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0 }}>📊</div>
          {sidebar && <span style={{ fontSize:14,fontWeight:800,letterSpacing:'-0.02em',whiteSpace:'nowrap' }}>Trade<span style={{ color:T.p }}>Daddy</span></span>}
        </div>

        {/* User chip */}
        {sidebar && user && (
          <div style={{ margin:'0 12px 18px',padding:'8px 12px',background:T.card,border:`1px solid ${T.border}`,borderRadius:10,display:'flex',alignItems:'center',gap:8 }}>
            <div style={{ width:24,height:24,borderRadius:7,background:`linear-gradient(135deg,${T.p},#9B59B6)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0 }}>
              {(user.name||'?')[0].toUpperCase()}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:12,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user.name}</div>
              <div style={{ fontSize:10,color:T.d,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user.email}</div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex:1,display:'flex',flexDirection:'column',gap:2,padding:'0 8px',overflowY:'auto' }}>
          {NAV.map(item=>(
            <button key={item.id} onClick={()=>setPage(item.id)} title={!sidebar?item.label:''}
              style={{ display:'flex',alignItems:'center',gap:11,padding:sidebar?'9px 12px':'9px 0',justifyContent:sidebar?'flex-start':'center',border:'none',borderRadius:10,cursor:'pointer',fontFamily:T.font,fontSize:13,fontWeight:page===item.id?600:400,transition:'all 0.15s',whiteSpace:'nowrap',
                background: page===item.id ? 'rgba(91,46,255,0.18)' : 'transparent',
                color: page===item.id ? '#fff' : T.m,
                borderLeft: page===item.id ? `3px solid ${T.p}` : '3px solid transparent',
              }}
              onMouseEnter={e=>{ if(page!==item.id){ e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.color='rgba(255,255,255,0.8)' }}}
              onMouseLeave={e=>{ if(page!==item.id){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color=T.m }}}>
              <span style={{ fontSize:15,flexShrink:0 }}>{item.icon}</span>
              {sidebar && item.label}
            </button>
          ))}
        </nav>

        {/* Collapse */}
        <button onClick={()=>setSidebar(!sidebar)} style={{ margin:'8px 10px 0',padding:'8px',border:`1px solid ${T.border}`,borderRadius:9,background:'transparent',color:T.d,cursor:'pointer',fontSize:12,textAlign:'center',transition:'all 0.15s' }}
          onMouseEnter={e=>{e.target.style.borderColor=T.borderHi;e.target.style.color=T.m}}
          onMouseLeave={e=>{e.target.style.borderColor=T.border;e.target.style.color=T.d}}>
          {sidebar?'◀':'▶'}
        </button>
      </aside>

      {/* Main */}
      <main style={{ flex:1,overflow:'auto',padding:'26px 30px',minWidth:0 }}>
        {error && <div style={{ marginBottom:16,padding:'10px 14px',background:'rgba(255,77,106,0.08)',border:'1px solid rgba(255,77,106,0.2)',borderRadius:11,color:T.r,fontSize:13 }}>⚠ {error} — Check Worker deployment</div>}
        {loading && page==='dashboard' ? (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'50vh',flexDirection:'column',gap:12,color:T.d }}>
            <div style={{ fontSize:32 }}>⟳</div>
            <div style={{ fontSize:14 }}>Loading your portfolio…</div>
          </div>
        ) : pages[page]}
      </main>
    </div>
  )
}