/**
 * Dashboard.jsx v4 — TradeDaddy
 * Fixed: named imports, useNavigate at root level, HuggingFace chat
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { groqChat } from '../utils/api'
import {
  getTrades, createTrade, updateTrade, deleteTrade,
  getHoldings, createHolding, deleteHolding, clearHoldings,
  uploadImage, connectDhan, getDhanHoldings, getDhanStatus, disconnectDhan,
  getMt5Positions, getMt5Status,
  auth, logoutUser
} from '../utils/api'
import Scanner from './Scanner'
import News from './News'
import EconomicCalendar from './EconomicCalendar'
import SectorAnalysis from './SectorAnalysis'

const C = { bg:'#09070f', s:'rgba(255,255,255,0.03)', b:'rgba(255,255,255,0.07)', p:'#5227FF', g:'#34C77B', r:'#FF5C5C', a:'#F59E0B', m:'rgba(255,255,255,0.4)', f:'rgba(255,255,255,0.06)' }

const NAV = [
  { icon:'▣',  label:'Dashboard', id:'dashboard' },
  { icon:'📋', label:'Journal',   id:'journal' },
  { icon:'📊', label:'Holdings',  id:'holdings' },
  { icon:'🔍', label:'Scanner',   id:'scanner' },
  { icon:'📈', label:'Sectors',   id:'sectors' },
  { icon:'📰', label:'News',      id:'news' },
  { icon:'📅', label:'Calendar',  id:'calendar' },
  { icon:'🤖', label:'AI Chat',   id:'chat' },
  { icon:'⚙',  label:'Settings',  id:'settings' },
]

const fmtInr = n => n!=null?(n>=0?`+₹${Math.abs(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`:'-₹'+Math.abs(n).toLocaleString('en-IN',{maximumFractionDigits:0})):'—'

/* ── Equity Curve from trades ── */
function EquityChart({ trades }) {
  const BASE = 100000
  const sorted = [...trades].filter(t=>t.pnl!=null).sort((a,b)=>new Date(a.date)-new Date(b.date))
  const curve = [BASE]; sorted.forEach(t=>{ curve.push(+(curve[curve.length-1]+(t.pnl||0)).toFixed(2)) })
  if (curve.length < 2) return <div style={{ height:120,display:'flex',alignItems:'center',justifyContent:'center',color:C.m,fontSize:13 }}>Log trades to build your equity curve</div>
  const W=560,H=120,P=16,min=Math.min(...curve),max=Math.max(...curve),range=max-min||1
  const sx=i=>P+(i/(curve.length-1))*(W-P*2), sy=v=>H-P-((v-min)/range)*(H-P*2)
  const line=curve.map((v,i)=>`${i===0?'M':'L'}${sx(i)},${sy(v)}`).join(' ')
  const area=`${line} L${sx(curve.length-1)},${H} L${sx(0)},${H} Z`
  const ret=+(((curve[curve.length-1]-BASE)/BASE)*100).toFixed(2), isUp=ret>=0
  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:8 }}>
        <span style={{ fontSize:12,color:C.m }}>Starting: ₹{BASE.toLocaleString('en-IN')}</span>
        <span style={{ fontSize:13,fontWeight:700,color:isUp?C.g:C.r }}>{isUp?'+':''}{ret}% · ₹{curve[curve.length-1].toLocaleString('en-IN',{maximumFractionDigits:0})}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%',height:'auto',overflow:'visible' }}>
        <defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={isUp?C.g:C.r} stopOpacity="0.3"/><stop offset="100%" stopColor={isUp?C.g:C.r} stopOpacity="0"/></linearGradient></defs>
        <path d={area} fill="url(#eq)"/>
        <path d={line} fill="none" stroke={isUp?C.g:C.r} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={sx(curve.length-1)} cy={sy(curve[curve.length-1])} r="5" fill={isUp?C.g:C.r}/>
        <circle cx={sx(curve.length-1)} cy={sy(curve[curve.length-1])} r="10" fill={isUp?C.g:C.r} fillOpacity="0.2"/>
      </svg>
    </div>
  )
}

/* ── Allocation Donut ── */
function AllocDonut({ holdings }) {
  const R=50,cx=70,cy=70,stroke=16,circ=2*Math.PI*R
  const groups={};let total=0
  holdings.forEach(h=>{
    const k=h.exchange==='MT5'||h.exchange==='FOREX'?'Forex':h.exchange==='OPT'?'Options':'Equities'
    const v=(h.qty||0)*(h.avg_price||0); groups[k]=(groups[k]||0)+v; total+=v
  })
  const COLORS={Equities:C.p,Options:'#9B59B6',Forex:'#C084FC'}
  const alloc=total>0?Object.entries(groups).map(([l,v])=>({l,pct:+(v/total*100).toFixed(1),color:COLORS[l]||C.m})):[{l:'No data',pct:100,color:'rgba(255,255,255,0.08)'}]
  let offset=0
  const tf=total>0?(total>=1e5?`₹${(total/1e5).toFixed(1)}L`:`₹${total.toLocaleString('en-IN',{maximumFractionDigits:0})}`):'—'
  return (
    <div style={{ display:'flex',alignItems:'center',gap:16 }}>
      <svg viewBox="0 0 140 140" style={{ width:120,height:120,flexShrink:0 }}>
        {alloc.map(s=>{const d=(s.pct/100)*circ;const el=<circle key={s.l} cx={cx} cy={cy} r={R} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${d} ${circ-d}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`}/>;offset+=d;return el})}
        <text x={cx} y={cy-5} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800">{tf}</text>
        <text x={cx} y={cy+10} textAnchor="middle" fill={C.m} fontSize="8">Portfolio</text>
      </svg>
      <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
        {total===0?<span style={{ fontSize:12,color:C.m }}>Add holdings</span>:alloc.map(a=>(
          <div key={a.l} style={{ display:'flex',alignItems:'center',gap:8 }}>
            <div style={{ width:8,height:8,borderRadius:3,background:a.color,flexShrink:0 }}/>
            <span style={{ fontSize:12,color:C.m }}>{a.l}</span>
            <span style={{ fontSize:12,fontWeight:700,color:'#fff',marginLeft:'auto',paddingLeft:8 }}>{a.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label,value,sub,color }) {
  return (
    <div style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:15,padding:'16px 18px' }}>
      <p style={{ margin:'0 0 4px',fontSize:10,color:C.m,textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:600 }}>{label}</p>
      <p style={{ margin:'0 0 2px',fontSize:22,fontWeight:800,color:color||'#fff',letterSpacing:'-0.02em' }}>{value}</p>
      {sub&&<p style={{ margin:0,fontSize:11,color:C.m }}>{sub}</p>}
    </div>
  )
}

/* ── Trade Modal ── */
function TradeModal({ initial, onSave, onClose }) {
  const E={symbol:'',type:'LONG',entry:'',exit:'',qty:'',pnl:'',date:new Date().toISOString().slice(0,10),emotion:'😊',discipline:80,setup:'',notes:'',image_url:''}
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
      if(!pnl&&form.entry&&form.exit&&form.qty){const diff=form.type==='LONG'?(+form.exit-+form.entry):(+form.entry-+form.exit);pnl=+(diff*+form.qty).toFixed(2)}
      await onSave({...form,entry:+form.entry,exit:+form.exit||null,qty:+form.qty,pnl,image_url})
    }finally{setSav(false)}
  }
  const inp=(label,name,type='text',ph='')=>(
    <div key={name}>
      <label style={{ display:'block',fontSize:10,fontWeight:600,color:C.m,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em' }}>{label}</label>
      <input name={name} type={type} value={form[name]??''} onChange={e=>set(name,e.target.value)} placeholder={ph}
        style={{ width:'100%',padding:'9px 11px',background:'rgba(255,255,255,0.05)',border:`1px solid ${C.b}`,borderRadius:9,color:'#fff',fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box' }}
        onFocus={e=>e.target.style.borderColor=C.p} onBlur={e=>e.target.style.borderColor=C.b}/>
    </div>
  )
  return (
    <div style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.82)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24 }} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{ background:'#0d0b16',border:'1px solid rgba(82,39,255,0.3)',borderRadius:20,padding:'24px 26px',width:'100%',maxWidth:500,maxHeight:'90vh',overflowY:'auto' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
          <h3 style={{ margin:0,fontSize:15,fontWeight:800 }}>{initial?'Edit Trade':'Log New Trade'}</h3>
          <button onClick={onClose} style={{ background:'none',border:'none',color:C.m,fontSize:18,cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 120px',gap:10 }}>
            {inp('Symbol','symbol','text','RELIANCE, XAUUSD…')}
            <div>
              <label style={{ display:'block',fontSize:10,fontWeight:600,color:C.m,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em' }}>Type</label>
              <div style={{ display:'flex',gap:5 }}>
                {['LONG','SHORT'].map(t=><button key={t} onClick={()=>set('type',t)} style={{ flex:1,padding:'9px 0',border:'none',borderRadius:9,fontFamily:'inherit',fontSize:12,fontWeight:700,cursor:'pointer',background:form.type===t?(t==='LONG'?'rgba(52,199,123,0.2)':'rgba(255,92,92,0.2)'):'rgba(255,255,255,0.05)',color:form.type===t?(t==='LONG'?C.g:C.r):C.m }}>{t}</button>)}
              </div>
            </div>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10 }}>{inp('Entry ₹','entry','number','0')}{inp('Exit ₹','exit','number','0')}{inp('Qty','qty','number','1')}</div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>{inp('Date','date','date')}{inp('Setup','setup','text','Breakout…')}</div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
            <div>
              <label style={{ display:'block',fontSize:10,fontWeight:600,color:C.m,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em' }}>Emotion</label>
              <div style={{ display:'flex',gap:5 }}>
                {['😊','😐','😤','😰','🤑'].map(e=><button key={e} onClick={()=>set('emotion',e)} style={{ flex:1,padding:'6px 0',border:`1px solid ${form.emotion===e?C.p:C.b}`,borderRadius:8,background:form.emotion===e?'rgba(82,39,255,0.2)':'rgba(255,255,255,0.04)',fontSize:14,cursor:'pointer' }}>{e}</button>)}
              </div>
            </div>
            <div>
              <label style={{ display:'block',fontSize:10,fontWeight:600,color:C.m,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em' }}>Discipline {form.discipline}/100</label>
              <input type="range" min="0" max="100" value={form.discipline} onChange={e=>set('discipline',+e.target.value)} style={{ width:'100%',accentColor:C.p,marginTop:10 }}/>
            </div>
          </div>
          <div>
            <label style={{ display:'block',fontSize:10,fontWeight:600,color:C.m,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em' }}>Notes</label>
            <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="What happened? Why?" rows={3} style={{ width:'100%',padding:'9px 11px',background:'rgba(255,255,255,0.05)',border:`1px solid ${C.b}`,borderRadius:9,color:'#fff',fontSize:13,outline:'none',fontFamily:'inherit',resize:'vertical',boxSizing:'border-box' }} onFocus={e=>e.target.style.borderColor=C.p} onBlur={e=>e.target.style.borderColor=C.b}/>
          </div>
          <div>
            <label style={{ display:'block',fontSize:10,fontWeight:600,color:C.m,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em' }}>Chart Screenshot</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display:'none' }}/>
            {preview?(
              <div style={{ position:'relative',borderRadius:9,overflow:'hidden',border:`1px solid ${C.b}` }}>
                <img src={preview} alt="chart" style={{ width:'100%',maxHeight:180,objectFit:'cover',display:'block' }}/>
                <button onClick={()=>{setImg(null);setPrev('');set('image_url','')}} style={{ position:'absolute',top:6,right:6,background:'rgba(0,0,0,0.7)',border:'none',borderRadius:6,color:'#fff',padding:'3px 9px',cursor:'pointer',fontSize:11 }}>✕</button>
              </div>
            ):(
              <div onClick={()=>fileRef.current?.click()} style={{ border:`2px dashed ${C.b}`,borderRadius:11,padding:'18px 0',textAlign:'center',cursor:'pointer' }} onMouseEnter={e=>e.currentTarget.style.borderColor=C.p} onMouseLeave={e=>e.currentTarget.style.borderColor=C.b}>
                <div style={{ fontSize:22,marginBottom:3 }}>📸</div>
                <div style={{ fontSize:12,color:C.m }}>Upload chart screenshot · Stored in R2</div>
              </div>
            )}
          </div>
          <button onClick={handleSave} disabled={sav||up||!form.symbol} style={{ marginTop:2,padding:'12px 0',border:'none',borderRadius:11,background:!form.symbol?'rgba(82,39,255,0.3)':C.p,color:'#fff',fontSize:14,fontWeight:700,cursor:!form.symbol?'not-allowed':'pointer',fontFamily:'inherit' }}>
            {up?'📤 Uploading…':sav?'Saving…':initial?'Save Changes':'+ Log Trade'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Dashboard Home ── */
function DashboardHome({ trades, holdings }) {
  const totalPnL=trades.reduce((s,t)=>s+(t.pnl||0),0)
  const wins=trades.filter(t=>t.pnl>0).length
  const winRate=trades.length>0?Math.round(wins/trades.length*100):0
  const avgDisc=trades.length>0?Math.round(trades.reduce((s,t)=>s+(t.discipline||70),0)/trades.length):0
  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22 }}>
        <div>
          <h1 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800 }}>Good morning, Monish 👋</h1>
          <p style={{ margin:0,fontSize:13,color:C.m }}>{new Date().toDateString()}</p>
        </div>
        <div style={{ background:'rgba(82,39,255,0.15)',border:'1px solid rgba(82,39,255,0.3)',borderRadius:12,padding:'9px 14px',fontSize:13 }}>🟢 Cloudflare D1 · {trades.length} trades</div>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20 }}>
        <Stat label="Portfolio Value"  value={holdings.reduce((s,h)=>s+(h.qty||0)*(h.avg_price||0),0)>0?`₹${(holdings.reduce((s,h)=>s+(h.qty||0)*(h.avg_price||0),0)/1e5).toFixed(1)}L`:'—'} sub={`${holdings.length} holdings`}/>
        <Stat label="Total PnL"        value={fmtInr(totalPnL)} sub={`${trades.length} trades`} color={totalPnL>=0?C.g:C.r}/>
        <Stat label="Win Rate"         value={`${winRate}%`} sub={`${wins}W ${trades.length-wins}L`} color={winRate>=60?C.g:C.a}/>
        <Stat label="Avg Discipline"   value={`${avgDisc}/100`} sub="Journal" color="#C084FC"/>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 300px',gap:14,marginBottom:20 }}>
        <div style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:15,padding:'18px 20px' }}>
          <div style={{ display:'flex',justifyContent:'space-between',marginBottom:12 }}><h3 style={{ margin:0,fontSize:13,fontWeight:700,color:C.m }}>Equity Curve (real PnL)</h3></div>
          <EquityChart trades={trades}/>
        </div>
        <div style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:15,padding:'18px 20px' }}>
          <h3 style={{ margin:'0 0 14px',fontSize:13,fontWeight:700,color:C.m }}>Allocation</h3>
          <AllocDonut holdings={holdings}/>
        </div>
      </div>
      {trades.length>0&&(
        <div style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:15,padding:'18px 20px',marginBottom:16 }}>
          <h3 style={{ margin:'0 0 12px',fontSize:13,fontWeight:700,color:C.m }}>Recent Trades</h3>
          {trades.slice(0,5).map(t=>(
            <div key={t.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 10px',background:'rgba(255,255,255,0.02)',borderRadius:9,marginBottom:5 }}>
              <div style={{ display:'flex',alignItems:'center',gap:9 }}>
                <span>{t.emotion}</span><span style={{ fontWeight:700 }}>{t.symbol}</span>
                <span style={{ fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:5,background:t.type==='LONG'?'rgba(52,199,123,0.15)':'rgba(255,92,92,0.15)',color:t.type==='LONG'?C.g:C.r }}>{t.type}</span>
                {t.setup&&<span style={{ fontSize:11,color:C.m }}>#{t.setup}</span>}
              </div>
              <span style={{ fontWeight:800,color:(t.pnl||0)>=0?C.g:C.r }}>{fmtInr(t.pnl)}</span>
            </div>
          ))}
        </div>
      )}
      {trades.length>0&&(
        <div style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:15,padding:'18px 20px' }}>
          <h3 style={{ margin:'0 0 4px',fontSize:13,fontWeight:700,color:C.m }}>Emotional Tracker</h3>
          <p style={{ margin:'0 0 12px',fontSize:11,color:'rgba(255,255,255,0.2)' }}>One emoji per logged trade</p>
          <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
            {trades.slice(0,30).map((t,i)=><div key={i} title={`${t.symbol} ${t.date}`} style={{ width:32,height:32,borderRadius:9,fontSize:16,background:'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${C.f}` }}>{t.emotion||'😐'}</div>)}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Journal ── */
function JournalPage({ trades, onAdd, onDelete }) {
  const [show,setShow]=useState(false),[edit,setEdit]=useState(null),[filter,setFilter]=useState('ALL'),[search,setSearch]=useState('')
  const filtered=trades.filter(t=>{if(filter!=='ALL'&&t.type!==filter)return false;if(search&&!t.symbol.toLowerCase().includes(search.toLowerCase()))return false;return true})
  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
        <div><h1 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800 }}>Trade Journal</h1><p style={{ margin:0,fontSize:13,color:C.m }}>{trades.length} total · PnL: {fmtInr(trades.reduce((s,t)=>s+(t.pnl||0),0))}</p></div>
        <button onClick={()=>{setEdit(null);setShow(true)}} style={{ padding:'10px 20px',background:C.p,border:'none',borderRadius:12,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>+ Log Trade</button>
      </div>
      <div style={{ display:'flex',gap:8,marginBottom:16,flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search symbol…" style={{ padding:'8px 12px',background:C.s,border:`1px solid ${C.b}`,borderRadius:10,color:'#fff',fontSize:13,outline:'none',fontFamily:'inherit',width:160 }} onFocus={e=>e.target.style.borderColor=C.p} onBlur={e=>e.target.style.borderColor=C.b}/>
        {['ALL','LONG','SHORT'].map(f=><button key={f} onClick={()=>setFilter(f)} style={{ padding:'8px 14px',border:'none',borderRadius:10,fontFamily:'inherit',background:filter===f?C.p:C.s,color:filter===f?'#fff':C.m,fontSize:13,fontWeight:filter===f?700:400,cursor:'pointer',border:`1px solid ${filter===f?'transparent':C.b}` }}>{f}</button>)}
      </div>
      {filtered.length===0?<div style={{ textAlign:'center',padding:'60px 0',color:C.m }}>No trades. Click "+ Log Trade".</div>:(
        <div style={{ display:'flex',flexDirection:'column',gap:9 }}>{filtered.map(t=><TradeCard key={t.id} trade={t} onEdit={()=>{setEdit(t);setShow(true)}} onDelete={()=>onDelete(t.id)}/>)}</div>
      )}
      {show&&<TradeModal initial={edit} onClose={()=>{setShow(false);setEdit(null)}} onSave={async d=>{await onAdd(d,edit?.id);setShow(false);setEdit(null)}}/>}
    </div>
  )
}
function TradeCard({ trade:t,onEdit,onDelete }) {
  const [open,setOpen]=useState(false)
  return (
    <div style={{ background:C.s,border:`1px solid ${open?'rgba(82,39,255,0.3)':C.b}`,borderRadius:14,overflow:'hidden' }}>
      <div style={{ padding:'13px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer' }} onClick={()=>setOpen(!open)}>
        <div style={{ display:'flex',alignItems:'center',gap:9 }}>
          <span style={{ fontSize:17 }}>{t.emotion}</span>
          <span style={{ fontWeight:700,fontSize:14 }}>{t.symbol}</span>
          <span style={{ fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:5,background:t.type==='LONG'?'rgba(52,199,123,0.15)':'rgba(255,92,92,0.15)',color:t.type==='LONG'?C.g:C.r }}>{t.type}</span>
          {t.setup&&<span style={{ fontSize:11,color:C.m }}>#{t.setup}</span>}
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:16 }}>
          <span style={{ fontSize:12,color:C.m }}>{t.date?.slice(0,10)}</span>
          {t.image_url&&<span style={{ fontSize:10,color:'#C084FC' }}>📸</span>}
          <span style={{ fontWeight:800,fontSize:14,color:(t.pnl||0)>=0?C.g:C.r }}>{fmtInr(t.pnl)}</span>
          <span style={{ fontSize:11,fontWeight:700,color:t.discipline>=80?C.g:t.discipline>=60?C.a:C.r }}>{t.discipline}/100</span>
          <span style={{ color:C.m,fontSize:11 }}>{open?'▲':'▼'}</span>
        </div>
      </div>
      {open&&(
        <div style={{ borderTop:`1px solid ${C.f}`,padding:'12px 16px' }}>
          {t.image_url&&<div style={{ marginBottom:12,borderRadius:9,overflow:'hidden',border:`1px solid ${C.b}` }}><img src={t.image_url} alt="" style={{ width:'100%',maxHeight:200,objectFit:'cover',display:'block' }}/></div>}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:9,marginBottom:9 }}>
            {[['Entry',t.entry?`₹${(+t.entry).toLocaleString('en-IN')}`:'—'],['Exit',t.exit?`₹${(+t.exit).toLocaleString('en-IN')}`:'Open'],['Qty',t.qty]].map(([l,v])=>(
              <div key={l}><p style={{ margin:'0 0 2px',fontSize:10,color:C.m,textTransform:'uppercase',letterSpacing:'0.06em' }}>{l}</p><p style={{ margin:0,fontSize:13,fontWeight:600 }}>{v}</p></div>
            ))}
          </div>
          {t.notes&&<div style={{ marginBottom:9,padding:'9px 11px',background:'rgba(82,39,255,0.08)',borderRadius:9,border:'1px solid rgba(82,39,255,0.15)',fontSize:13,color:'rgba(255,255,255,0.7)',lineHeight:1.6 }}>{t.notes}</div>}
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
            <button onClick={onEdit} style={{ padding:'6px 13px',background:'rgba(82,39,255,0.15)',border:'1px solid rgba(82,39,255,0.3)',borderRadius:8,color:'#fff',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>Edit</button>
            <button onClick={onDelete} style={{ padding:'6px 13px',background:'rgba(255,92,92,0.1)',border:'1px solid rgba(255,92,92,0.2)',borderRadius:8,color:C.r,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Holdings ── */
function HoldingsPage({ holdings, onRefresh }) {
  const [showAdd,setShowAdd]=useState(false),[form,setForm]=useState({symbol:'',qty:'',avg_price:'',sector:'',exchange:'NSE'})
  const [saving,setSaving]=useState(false),[syncing,setSyncing]=useState(null),[msg,setMsg]=useState(null)
  const [mt5Status,setMt5Status]=useState(null)

  useEffect(()=>{
    getMt5Status().then(s=>setMt5Status(s)).catch(()=>{})
  },[])

  const syncDhan=async()=>{
    setSyncing('dhan');setMsg(null)
    try{
      const data=await getDhanHoldings()
      const list=Array.isArray(data)?data:(data.data||[])
      if(!list.length){setMsg({t:'warn',txt:'No holdings in Dhan.'});return}
      await clearHoldings()
      for(const h of list){await createHolding({symbol:h.tradingSymbol||h.symbol,qty:h.totalQty||h.quantity||1,avg_price:h.avgCostPrice||h.averagePrice||0,sector:h.sectorName||'',exchange:'NSE'})}
      setMsg({t:'ok',txt:`✅ Synced ${list.length} holdings from Dhan`});onRefresh()
    }catch(e){setMsg({t:'err',txt:e.message.includes('not connected')?'❌ Dhan not connected. Go to Settings → Brokers.':(`❌ ${e.message}`)})}
    finally{setSyncing(null)}
  }
  const syncMt5=async()=>{
    setSyncing('mt5');setMsg(null)
    try{
      const data=await getMt5Positions()
      if(!data.connected){setMsg({t:'warn',txt:'⚠ MT5 bridge offline. Run mt5_bridge.py on your desktop.'});return}
      for(const p of (data.positions||[])){await createHolding({symbol:p.symbol,qty:p.volume,avg_price:p.openPrice,sector:'Forex',exchange:'MT5'})}
      setMsg({t:'ok',txt:`✅ Synced ${data.positions?.length||0} MT5 positions`});onRefresh()
    }catch(e){setMsg({t:'err',txt:`❌ ${e.message}`})}
    finally{setSyncing(null)}
  }
  const handleAdd=async()=>{
    if(!form.symbol||!form.qty||!form.avg_price)return;setSaving(true)
    try{await createHolding({...form,qty:+form.qty,avg_price:+form.avg_price});setForm({symbol:'',qty:'',avg_price:'',sector:'',exchange:'NSE'});setShowAdd(false);onRefresh()}finally{setSaving(false)}
  }
  const msgBg={ok:'rgba(52,199,123,0.08)',warn:'rgba(245,158,11,0.08)',err:'rgba(255,92,92,0.08)'}
  const msgBorder={ok:'rgba(52,199,123,0.3)',warn:'rgba(245,158,11,0.3)',err:'rgba(255,92,92,0.3)'}

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
        <div><h1 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800 }}>Holdings</h1><p style={{ margin:0,fontSize:13,color:C.m }}>{holdings.length} positions</p></div>
        <button onClick={()=>setShowAdd(!showAdd)} style={{ padding:'10px 18px',background:C.p,border:'none',borderRadius:12,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>+ Add</button>
      </div>
      {/* Broker sync */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:18 }}>
        <div style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:16,padding:'16px 18px' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
            <div><div style={{ fontWeight:700,fontSize:14 }}>🏦 Dhan (NSE/BSE)</div><div style={{ fontSize:11,color:C.m }}>Configure in Settings → Brokers</div></div>
            <button onClick={syncDhan} disabled={!!syncing} style={{ padding:'7px 14px',background:syncing==='dhan'?'rgba(82,39,255,0.4)':C.p,border:'none',borderRadius:10,color:'#fff',fontSize:12,fontWeight:700,cursor:syncing?'not-allowed':'pointer',fontFamily:'inherit' }}>{syncing==='dhan'?'Syncing…':'⟳ Sync'}</button>
          </div>
        </div>
        <div style={{ background:C.s,border:`1px solid ${mt5Status?.connected?'rgba(52,199,123,0.3)':C.b}`,borderRadius:16,padding:'16px 18px' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
            <div>
              <div style={{ fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:8 }}>
                📈 MetaTrader 5
                {mt5Status?.connected&&<span style={{ fontSize:10,color:C.g,fontWeight:600 }}>● Live</span>}
                {mt5Status?.connected===false&&<span style={{ fontSize:10,color:C.r,fontWeight:600 }}>● Offline</span>}
              </div>
              <div style={{ fontSize:11,color:C.m }}>{mt5Status?.connected?`Last sync: ${new Date(mt5Status.lastSync).toLocaleTimeString()}`:'Run mt5_bridge.py on desktop'}</div>
            </div>
            <button onClick={syncMt5} disabled={!!syncing} style={{ padding:'7px 14px',background:syncing==='mt5'?'rgba(52,199,123,0.3)':C.g,border:'none',borderRadius:10,color:'#fff',fontSize:12,fontWeight:700,cursor:syncing?'not-allowed':'pointer',fontFamily:'inherit' }}>{syncing==='mt5'?'Syncing…':'⟳ Sync'}</button>
          </div>
        </div>
      </div>
      {msg&&<div style={{ padding:'10px 14px',background:msgBg[msg.t],border:`1px solid ${msgBorder[msg.t]}`,borderRadius:12,fontSize:13,color:'#fff',marginBottom:14 }}>{msg.txt}</div>}
      {showAdd&&(
        <div style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:14,padding:'16px 18px',marginBottom:16 }}>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:9,marginBottom:9 }}>
            {[['Symbol','symbol','RELIANCE'],['Qty','qty','10'],['Avg Price','avg_price','2800'],['Sector','sector','IT']].map(([l,k,ph])=>(
              <div key={k}>
                <label style={{ display:'block',fontSize:10,fontWeight:600,color:C.m,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em' }}>{l}</label>
                <input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={ph}
                  style={{ width:'100%',padding:'8px 10px',background:'rgba(255,255,255,0.05)',border:`1px solid ${C.b}`,borderRadius:9,color:'#fff',fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box' }}
                  onFocus={e=>e.target.style.borderColor=C.p} onBlur={e=>e.target.style.borderColor=C.b}/>
              </div>
            ))}
            <div style={{ display:'flex',alignItems:'flex-end' }}>
              <button onClick={handleAdd} disabled={saving} style={{ width:'100%',padding:'8px 0',background:C.p,border:'none',borderRadius:9,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>{saving?'…':'Add'}</button>
            </div>
          </div>
        </div>
      )}
      {holdings.length===0?<div style={{ textAlign:'center',padding:'60px 0',color:C.m }}>No holdings. Sync from Dhan/MT5 or add manually.</div>:(
        <div style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:14,overflow:'hidden' }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead><tr style={{ borderBottom:`1px solid ${C.b}` }}>{['Symbol','Exchange','Sector','Qty','Avg',''].map(h=><th key={h} style={{ padding:'10px 14px',fontSize:10,fontWeight:700,color:C.m,textTransform:'uppercase',letterSpacing:'0.06em',textAlign:h===''?'right':'left' }}>{h}</th>)}</tr></thead>
            <tbody>
              {holdings.map(h=>(
                <tr key={h.id} style={{ borderBottom:`1px solid ${C.f}` }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'11px 14px',fontWeight:700,fontSize:14 }}>{h.symbol}</td>
                  <td style={{ padding:'11px 14px' }}><span style={{ padding:'2px 7px',borderRadius:6,background:h.exchange==='MT5'?'rgba(52,199,123,0.1)':'rgba(82,39,255,0.1)',color:h.exchange==='MT5'?C.g:'#C084FC',fontSize:10,fontWeight:700 }}>{h.exchange}</span></td>
                  <td style={{ padding:'11px 14px',fontSize:13,color:C.m }}>{h.sector||'—'}</td>
                  <td style={{ padding:'11px 14px',fontSize:13 }}>{h.qty}</td>
                  <td style={{ padding:'11px 14px',fontSize:13,fontWeight:600 }}>₹{(+h.avg_price).toLocaleString('en-IN')}</td>
                  <td style={{ padding:'11px 14px',textAlign:'right' }}><button onClick={async()=>{await deleteHolding(h.id);onRefresh()}} style={{ padding:'4px 10px',background:'rgba(255,92,92,0.08)',border:'1px solid rgba(255,92,92,0.15)',borderRadius:7,color:C.r,fontSize:11,cursor:'pointer',fontFamily:'inherit' }}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── AI Chat (HuggingFace Mistral) ── */
function ChatPage({ trades, holdings }) {
  const [messages,setMessages]=useState([{role:'assistant',text:'Hi Monish! I\'m powered by Mistral-7B via HuggingFace. Ask me about your portfolio, sectors, or market conditions. Set your HF token in Sector Analysis page to enable.'}])
  const [input,setInput]=useState(''),[loading,setLoading]=useState(false)
  const bottomRef=useRef()
  const SUGGS=['Summarize my trading this week','What patterns in my losing trades?','How does RBI affect HDFC Bank?','Best performing setup?']

  const send=async(msg)=>{
    const text=msg||input.trim();if(!text)return
    setInput('');setMessages(p=>[...p,{role:'user',text}]);setLoading(true)
    try{
      const ctx=`Holdings:${JSON.stringify(holdings.slice(0,8))}. Trades(last 15):${JSON.stringify(trades.slice(0,15).map(t=>({sym:t.symbol,type:t.type,pnl:t.pnl,discipline:t.discipline,setup:t.setup})))}. Total PnL:₹${trades.reduce((s,t)=>s+(t.pnl||0),0).toFixed(0)}, WinRate:${trades.length>0?Math.round(trades.filter(t=>t.pnl>0).length/trades.length*100):0}%`
      const reply = await groqChat(
        [{ role: 'user', content: text }],
        `You are TradeDaddy AI, an expert Indian stock market assistant for Monish. Portfolio context: ${ctx}. Be concise and actionable, reference specific trades/holdings when relevant. Keep answers under 200 words.`
      )
      setMessages(p=>[...p,{role:'assistant',text:reply}])
    }catch(e){setMessages(p=>[...p,{role:'assistant',text:e.message.includes('loading')?e.message:`Error: ${e.message}. Make sure HuggingFace token is set in Sectors page.`}])}
    finally{setLoading(false);setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),100)}
  }

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'calc(100vh - 90px)' }}>
      <h1 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800 }}>AI Chat</h1>
      <p style={{ margin:'0 0 14px',fontSize:13,color:C.m }}>Powered by Mistral-7B via HuggingFace (free) · portfolio-aware</p>
      {!localStorage.getItem('hf_token')&&<div style={{ padding:'9px 14px',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:12,fontSize:12,color:C.a,marginBottom:12 }}>⚡ Set your HuggingFace token in <strong>Sectors page</strong> for best results. Free at huggingface.co/settings/tokens</div>}
      <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:12 }}>
        {SUGGS.map(s=><button key={s} onClick={()=>send(s)} style={{ padding:'6px 12px',border:'1px solid rgba(82,39,255,0.3)',borderRadius:999,background:'rgba(82,39,255,0.1)',color:'rgba(255,255,255,0.7)',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>{s}</button>)}
      </div>
      <div style={{ flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,paddingRight:4,marginBottom:10 }}>
        {messages.map((m,i)=>(
          <div key={i} style={{ display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{ maxWidth:'74%',padding:'11px 14px',borderRadius:m.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',background:m.role==='user'?'rgba(82,39,255,0.3)':C.s,border:`1px solid ${m.role==='user'?'rgba(82,39,255,0.4)':C.b}`,fontSize:14,lineHeight:1.65,color:'rgba(255,255,255,0.9)',whiteSpace:'pre-wrap' }}>
              {m.role==='assistant'&&<span style={{ marginRight:8 }}>🤖</span>}{m.text}
            </div>
          </div>
        ))}
        {loading&&<div style={{ display:'flex' }}><div style={{ padding:'11px 14px',borderRadius:'16px 16px 16px 4px',background:C.s,border:`1px solid ${C.b}`,fontSize:14,color:C.m }}>🤖 Thinking…</div></div>}
        <div ref={bottomRef}/>
      </div>
      <div style={{ display:'flex',gap:9 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Ask about your portfolio, setups, or markets…"
          style={{ flex:1,padding:'12px 16px',background:C.s,border:`1px solid ${C.b}`,borderRadius:14,color:'#fff',fontSize:14,outline:'none',fontFamily:'inherit' }}
          onFocus={e=>e.target.style.borderColor=C.p} onBlur={e=>e.target.style.borderColor=C.b}/>
        <button onClick={()=>send()} disabled={loading||!input.trim()} style={{ padding:'12px 20px',background:C.p,border:'none',borderRadius:14,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',opacity:loading||!input.trim()?0.5:1 }}>↑</button>
      </div>
    </div>
  )
}

/* ── Settings ── */
function SettingsPage({ onLogout }) {
  const [dhanForm,setDhanForm]=useState({clientId:'',accessToken:''})
  const [dhanStat,setDhanStat]=useState(null),[dhanMsg,setDhanMsg]=useState(null),[saving,setSaving]=useState(false)

  useEffect(()=>{
    getDhanStatus().then(s=>setDhanStat(s)).catch(()=>{})
  },[])

  const connectDhanBroker=async()=>{
    if(!dhanForm.clientId||!dhanForm.accessToken){setDhanMsg({t:'err',txt:'Both fields required'});return}
    setSaving(true);setDhanMsg(null)
    try{
      await connectDhan(dhanForm.clientId,dhanForm.accessToken)
      setDhanMsg({t:'ok',txt:'✅ Dhan connected! Go to Holdings → Sync Holdings.'})
      setDhanStat({connected:true,clientId:`****${dhanForm.clientId.slice(-4)}`})
      setDhanForm({clientId:'',accessToken:''})
    }catch(e){setDhanMsg({t:'err',txt:`❌ ${e.message}`})}finally{setSaving(false)}
  }

  const msgBg={ok:'rgba(52,199,123,0.08)',err:'rgba(255,92,92,0.08)'}
  const msgBorder={ok:'rgba(52,199,123,0.25)',err:'rgba(255,92,92,0.25)'}
  const inp=(label,name,type='text',ph='',mono=false)=>(
    <div>
      <label style={{ display:'block',fontSize:11,fontWeight:600,color:C.m,marginBottom:5,textTransform:'uppercase',letterSpacing:'0.06em' }}>{label}</label>
      <input type={type} value={dhanForm[name]} onChange={e=>setDhanForm(f=>({...f,[name]:e.target.value}))} placeholder={ph}
        style={{ width:'100%',padding:'10px 12px',background:'rgba(255,255,255,0.05)',border:`1px solid ${C.b}`,borderRadius:10,color:'#fff',fontSize:13,outline:'none',fontFamily:mono?'monospace':'inherit',boxSizing:'border-box' }}
        onFocus={e=>e.target.style.borderColor=C.p} onBlur={e=>e.target.style.borderColor=C.b}/>
    </div>
  )

  return (
    <div>
      <h1 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800 }}>Settings</h1>
      <p style={{ margin:'0 0 24px',fontSize:13,color:C.m }}>Configure broker connections</p>
      {/* Dhan */}
      <div style={{ background:C.s,border:`1px solid ${dhanStat?.connected?'rgba(52,199,123,0.3)':C.b}`,borderRadius:16,padding:'20px 22px',marginBottom:18,maxWidth:520 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
          <div>
            <div style={{ fontSize:16,fontWeight:800,display:'flex',alignItems:'center',gap:10 }}>🏦 Dhan Broker
              {dhanStat?.connected&&<span style={{ fontSize:11,color:C.g,fontWeight:600,padding:'2px 8px',background:'rgba(52,199,123,0.1)',borderRadius:6 }}>● Connected {dhanStat.clientId}</span>}
            </div>
            <div style={{ fontSize:12,color:C.m,marginTop:3 }}>Get credentials at <a href="https://dhanhq.co" target="_blank" style={{ color:C.p }}>dhanhq.co</a> → API Access</div>
          </div>
          {dhanStat?.connected&&<button onClick={async()=>{await disconnectDhan();setDhanStat({connected:false})}} style={{ padding:'6px 13px',background:'rgba(255,92,92,0.1)',border:'1px solid rgba(255,92,92,0.2)',borderRadius:8,color:C.r,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>Disconnect</button>}
        </div>
        {!dhanStat?.connected&&(
          <div style={{ display:'flex',flexDirection:'column',gap:11 }}>
            {inp('Client ID','clientId','text','Your Dhan Client ID',true)}
            {inp('Access Token','accessToken','password','Access token from Dhan portal',true)}
            <button onClick={connectDhanBroker} disabled={saving} style={{ padding:'11px 0',background:C.p,border:'none',borderRadius:11,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:saving?0.7:1 }}>{saving?'Connecting…':'Connect Dhan'}</button>
          </div>
        )}
        {dhanMsg&&<div style={{ marginTop:10,padding:'9px 13px',background:msgBg[dhanMsg.t],border:`1px solid ${msgBorder[dhanMsg.t]}`,borderRadius:10,fontSize:13,color:'#fff' }}>{dhanMsg.txt}</div>}
      </div>
      {/* MT5 */}
      <div style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:16,padding:'20px 22px',marginBottom:18,maxWidth:520 }}>
        <div style={{ fontSize:16,fontWeight:800,marginBottom:8 }}>📈 MetaTrader 5 Bridge</div>
        <div style={{ fontSize:13,color:C.m,lineHeight:1.7,marginBottom:12 }}>MT5 is a desktop app — run the Python bridge script to sync positions to TradeDaddy every 60 seconds.</div>
        <ol style={{ margin:0,padding:'0 0 0 18px',display:'flex',flexDirection:'column',gap:5 }}>
          {['Download mt5_bridge.py (delivered with these files)','pip install MetaTrader5 requests','Get your JWT token: DevTools (F12) → Application → Local Storage → td_token','Paste token in mt5_bridge.py','Run: python mt5_bridge.py','Go to Holdings → click ⟳ Sync (MT5)'].map((s,i)=><li key={i} style={{ fontSize:13,color:'rgba(255,255,255,0.7)' }}>{s}</li>)}
        </ol>
      </div>
      {/* Account */}
      <div style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:16,padding:'20px 22px',maxWidth:520 }}>
        <div style={{ fontSize:16,fontWeight:800,marginBottom:14 }}>👤 Account</div>
        <button onClick={onLogout} style={{ padding:'10px 22px',background:'rgba(255,92,92,0.1)',border:'1px solid rgba(255,92,92,0.25)',borderRadius:12,color:C.r,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit' }}>Sign Out</button>
      </div>
    </div>
  )
}

/* ── ROOT ── */
export default function Dashboard() {
  const navigate = useNavigate()
  const [page,    setPage]    = useState('dashboard')
  const [sidebar, setSidebar] = useState(true)
  const [trades,  setTrades]  = useState([])
  const [holdings,setHoldings]= useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const loadAll=async()=>{
    setLoading(true)
    try{
      const [t,h]=await Promise.all([getTrades(),getHoldings()])
      setTrades(t);setHoldings(h);setError(null)
    }catch(e){setError(e.message)}finally{setLoading(false)}
  }

  useEffect(()=>{loadAll()},[])

  const handleAddTrade=async(data,existingId)=>{
    if(existingId){const u=await updateTrade(existingId,data);setTrades(p=>p.map(t=>t.id===existingId?u:t))}
    else{const c=await createTrade(data);setTrades(p=>[c,...p])}
  }

  const handleLogout=()=>{logoutUser();navigate('/auth')}

  const PAGE_COMPONENTS = {
    dashboard: <DashboardHome trades={trades} holdings={holdings}/>,
    journal:   <JournalPage trades={trades} onAdd={handleAddTrade} onDelete={async id=>{await deleteTrade(id);setTrades(p=>p.filter(t=>t.id!==id))}}/>,
    holdings:  <HoldingsPage holdings={holdings} onRefresh={loadAll}/>,
    scanner:   <Scanner/>,
    sectors:   <SectorAnalysis/>,
    news:      <News/>,
    calendar:  <EconomicCalendar/>,
    chat:      <ChatPage trades={trades} holdings={holdings}/>,
    settings:  <SettingsPage onLogout={handleLogout}/>,
  }

  return (
    <div style={{ display:'flex',minHeight:'100vh',background:C.bg,fontFamily:"'Space Grotesk',sans-serif",color:'#fff' }}>
      {/* Sidebar */}
      <aside style={{ width:sidebar?215:60,flexShrink:0,background:'rgba(255,255,255,0.02)',borderRight:`1px solid ${C.b}`,display:'flex',flexDirection:'column',padding:'22px 0',transition:'width 0.3s cubic-bezier(.4,0,.2,1)',overflow:'hidden',position:'sticky',top:0,height:'100vh' }}>
        <div style={{ padding:'0 16px 22px',display:'flex',alignItems:'center',gap:9,justifyContent:sidebar?'flex-start':'center' }}>
          <div style={{ width:30,height:30,background:'linear-gradient(135deg,#5227FF,#9B59B6)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0 }}>📊</div>
          {sidebar&&<span style={{ fontSize:14,fontWeight:800,letterSpacing:'-0.02em',whiteSpace:'nowrap' }}>Trade<span style={{ color:C.p }}>Daddy</span></span>}
        </div>
        <nav style={{ flex:1,display:'flex',flexDirection:'column',gap:2,padding:'0 8px',overflowY:'auto' }}>
          {NAV.map(item=>(
            <button key={item.id} onClick={()=>setPage(item.id)} title={!sidebar?item.label:''}
              style={{ display:'flex',alignItems:'center',gap:10,padding:sidebar?'9px 11px':'9px 0',justifyContent:sidebar?'flex-start':'center',border:'none',borderRadius:10,cursor:'pointer',background:page===item.id?'rgba(82,39,255,0.2)':'transparent',color:page===item.id?'#fff':C.m,fontFamily:'inherit',fontSize:13,fontWeight:page===item.id?600:400,transition:'all 0.15s',whiteSpace:'nowrap',borderLeft:page===item.id?`3px solid ${C.p}`:'3px solid transparent' }}>
              <span style={{ fontSize:15,flexShrink:0 }}>{item.icon}</span>
              {sidebar&&item.label}
            </button>
          ))}
        </nav>
        <button onClick={()=>setSidebar(!sidebar)} style={{ margin:'0 8px',padding:'8px',border:`1px solid ${C.b}`,borderRadius:9,background:'transparent',color:C.m,cursor:'pointer',fontSize:12,textAlign:'center' }}>
          {sidebar?'◀':'▶'}
        </button>
      </aside>
      {/* Main */}
      <main style={{ flex:1,overflow:'auto',padding:'24px 28px' }}>
        {error&&<div style={{ marginBottom:16,padding:'10px 14px',background:'rgba(255,92,92,0.08)',border:'1px solid rgba(255,92,92,0.2)',borderRadius:12,color:C.r,fontSize:13 }}>⚠ {error}</div>}
        {loading&&page==='dashboard'?<div style={{ padding:'60px',textAlign:'center',color:C.m }}>Loading…</div>:PAGE_COMPONENTS[page]}
      </main>
    </div>
  )
}