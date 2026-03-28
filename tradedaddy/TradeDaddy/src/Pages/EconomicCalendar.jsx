import { useState, useEffect } from 'react'
import { getCalendar } from '../utils/api'

const C = { s:'rgba(255,255,255,0.03)', b:'rgba(255,255,255,0.07)', p:'#5227FF', g:'#34C77B', r:'#FF5C5C', a:'#F59E0B', m:'rgba(255,255,255,0.4)', f:'rgba(255,255,255,0.07)' }

const IMPACT_CFG = {
  HIGH:   { color:'#FF5C5C', bg:'rgba(255,92,92,0.12)',   border:'rgba(255,92,92,0.3)',   dot:'●', label:'High' },
  MEDIUM: { color:'#F59E0B', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)',  dot:'●', label:'Medium' },
  LOW:    { color:'rgba(255,255,255,0.25)', bg:'rgba(255,255,255,0.04)', border:'rgba(255,255,255,0.1)', dot:'○', label:'Low' },
}
const FLAGS = { USD:'🇺🇸', EUR:'🇪🇺', GBP:'🇬🇧', JPY:'🇯🇵', AUD:'🇦🇺', CAD:'🇨🇦', CHF:'🇨🇭', NZD:'🇳🇿', CNY:'🇨🇳', INR:'🇮🇳' }

function fmtDate(ds) {
  if (!ds) return '?'
  const d = new Date(ds), t = new Date(), tm = new Date(t); tm.setDate(t.getDate()+1)
  if (d.toDateString()===t.toDateString()) return 'Today'
  if (d.toDateString()===tm.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-IN',{weekday:'long',month:'short',day:'numeric'})
}

function groupByDate(events) {
  const g = {}
  events.forEach(e => { const k=(e.date||'').slice(0,10)||'Unknown'; if(!g[k]) g[k]=[]; g[k].push(e) })
  return Object.entries(g).sort(([a],[b])=>a.localeCompare(b))
}

function EventRow({ event }) {
  const [open, setOpen] = useState(false)
  const cfg = IMPACT_CFG[event.impactLevel] || IMPACT_CFG.LOW
  const flag = FLAGS[event.country] || '🌍'
  const desc = (() => {
    const t = (event.title||event.name||'').toLowerCase()
    if (t.includes('cpi')||t.includes('inflation')) return 'Inflation reading — higher than expected is bearish for equities and may prompt RBI to stay hawkish. Watch rate-sensitive sectors.'
    if (t.includes('non-farm')||t.includes('payroll')) return 'US jobs data — strong numbers boost USD, can trigger FII outflows from Indian markets.'
    if (t.includes('fomc')||t.includes('fed')) return 'US Federal Reserve meeting — hawkish tone = FII selling in emerging markets including India.'
    if (t.includes('rbi')) return 'RBI policy — direct impact on Nifty Bank, auto, real estate. Rate hold expected by markets.'
    if (t.includes('gdp')) return 'GDP growth — affects long-term FII sentiment and sector rotation.'
    if (t.includes('pmi')) return 'PMI — forward-looking economic health indicator. Above 50 = expansion.'
    return 'Economic data release — monitor deviation from forecast for short-term volatility.'
  })()

  return (
    <>
      <tr onClick={()=>setOpen(!open)} style={{ borderBottom:`1px solid ${C.f}`, cursor:'pointer', transition:'background 0.15s', background:open?'rgba(82,39,255,0.05)':'transparent' }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
        onMouseLeave={e=>e.currentTarget.style.background=open?'rgba(82,39,255,0.05)':'transparent'}>
        <td style={{ padding:'11px 14px', fontSize:13, color:C.m, whiteSpace:'nowrap' }}>{event.time||'—'}</td>
        <td style={{ padding:'11px 14px', textAlign:'center', fontSize:17 }}>{flag}</td>
        <td style={{ padding:'11px 14px', textAlign:'center' }}>
          <span style={{ color:cfg.color, fontSize:17, title:cfg.label }}>{cfg.dot}</span>
        </td>
        <td style={{ padding:'11px 14px' }}>
          <div style={{ fontSize:14, fontWeight:600 }}>{event.title||event.name}</div>
          {(event.relevance==='HIGH'||event.country==='INR') && <span style={{ fontSize:10, color:C.a, fontWeight:700 }}>🇮🇳 India Relevant</span>}
        </td>
        <td style={{ padding:'11px 14px', textAlign:'right', fontSize:13, color:'rgba(255,255,255,0.7)' }}>{event.forecast||'—'}</td>
        <td style={{ padding:'11px 14px', textAlign:'right', fontSize:13, color:C.m }}>{event.previous||'—'}</td>
        <td style={{ padding:'11px 14px', textAlign:'right', fontSize:13, fontWeight:700 }}>
          {event.isPast
            ? (event.actual
                ? <span style={{ color:parseFloat(event.actual)>=parseFloat(event.forecast)?C.g:C.r,fontWeight:700 }}>{event.actual}</span>
                : <span style={{ color:'rgba(255,255,255,0.3)',fontSize:11 }}>N/A</span>)
            : <span style={{ color:'rgba(255,255,255,0.2)',fontSize:11 }}>Pending</span>}
        </td>
        <td style={{ padding:'11px 14px' }}>
          <span style={{ padding:'2px 8px', borderRadius:999, fontSize:10, fontWeight:700, textTransform:'uppercase', background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`, whiteSpace:'nowrap' }}>{cfg.label}</span>
        </td>
      </tr>
      {open && (
        <tr style={{ background:'rgba(82,39,255,0.04)', borderBottom:`1px solid ${C.f}` }}>
          <td colSpan={8} style={{ padding:'10px 14px 14px 56px', fontSize:13, color:C.m, lineHeight:1.65 }}>
            📎 <strong style={{ color:'rgba(255,255,255,0.7)' }}>India Impact:</strong> {desc}
          </td>
        </tr>
      )}
    </>
  )
}

export default function EconomicCalendar() {
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [filter,  setFilter]  = useState('ALL')
  const [country, setCountry] = useState('ALL')

  useEffect(() => {
    setLoading(true)
    getCalendar()
      .then(data => setEvents(data.events||[]))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = events.filter(e => {
    if (filter!=='ALL' && e.impactLevel!==filter) return false
    if (country!=='ALL' && e.country!==country) return false
    return true
  })
  const grouped = groupByDate(filtered)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
        <div>
          <h1 style={{ margin:'0 0 4px', fontSize:22, fontWeight:800 }}>Economic Calendar</h1>
          <p style={{ margin:0, fontSize:13, color:C.m }}>{events.length} events this week · {events.filter(e=>e.impactLevel==='HIGH').length} high impact · Click any row for India context</p>
        </div>
      </div>

      {/* Stats */}
      {!loading && events.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
          {[['Total',events.length,'#fff'],['⚡ High',events.filter(e=>e.impactLevel==='HIGH').length,'#FF5C5C'],['🇺🇸 USD',events.filter(e=>e.country==='USD').length,'#85C1E9'],['🇮🇳 India',events.filter(e=>e.country==='INR'||e.relevance==='HIGH').length,'#F7DC6F']].map(([l,v,c])=>(
            <div key={l} style={{ background:C.s, border:`1px solid ${C.b}`, borderRadius:12, padding:'12px 16px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:C.m, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>{l}</div>
              <div style={{ fontSize:22, fontWeight:800, color:c }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Legend + Filters */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16, flexWrap:'wrap' }}>
        {Object.entries(IMPACT_CFG).map(([k,v])=>(
          <div key={k} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ color:v.color, fontSize:16 }}>{v.dot}</span>
            <span style={{ fontSize:12, color:v.color, fontWeight:600 }}>{v.label} Impact</span>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {['ALL','HIGH','MEDIUM','LOW'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'7px 14px', border:'none', borderRadius:10, fontFamily:'inherit', background:filter===f?'#5227FF':'rgba(255,255,255,0.06)', color:filter===f?'#fff':C.m, fontSize:12, fontWeight:filter===f?700:400, cursor:'pointer' }}>{f==='ALL'?'All':f==='HIGH'?'⚡ High':f==='MEDIUM'?'◎ Medium':'○ Low'}</button>
        ))}
        <select value={country} onChange={e=>setCountry(e.target.value)} style={{ padding:'7px 12px', background:'rgba(255,255,255,0.06)', border:`1px solid ${C.b}`, borderRadius:10, color:'#fff', fontSize:12, fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
          <option value="ALL">🌍 All Countries</option>
          {Object.entries(FLAGS).map(([k,f])=><option key={k} value={k}>{f} {k}</option>)}
        </select>
      </div>

      {error && <div style={{ padding:'12px 14px', background:'rgba(255,92,92,0.08)', border:'1px solid rgba(255,92,92,0.2)', borderRadius:12, color:'#FF5C5C', fontSize:13, marginBottom:14 }}>⚠ {error}</div>}

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{[...Array(6)].map((_,i)=><div key={i} style={{ height:50, background:C.s, borderRadius:10, opacity:0.4 }} />)}</div>
      ) : grouped.length===0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:C.m }}>No events with current filters.</div>
      ) : grouped.map(([date, evs])=>(
        <div key={date} style={{ marginBottom:28 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <span style={{ fontSize:15, fontWeight:800, color:fmtDate(date)==='Today'?'#5227FF':fmtDate(date)==='Tomorrow'?C.a:'#fff' }}>{fmtDate(date)}</span>
            <span style={{ fontSize:12, color:C.m }}>{new Date(date).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</span>
            {evs.filter(e=>e.impactLevel==='HIGH').length>0 && <span style={{ fontSize:11, color:'#FF5C5C', fontWeight:700 }}>⚡ {evs.filter(e=>e.impactLevel==='HIGH').length} high</span>}
          </div>
          <div style={{ background:C.s, border:`1px solid ${C.b}`, borderRadius:14, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${C.b}` }}>
                  {['Time','','Impact','Event','Forecast','Previous','Actual',''].map((h,i)=>(
                    <th key={i} style={{ padding:'10px 14px', fontSize:10, fontWeight:700, color:C.m, textTransform:'uppercase', letterSpacing:'0.05em', textAlign:i>=4?'right':'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evs.sort((a,b)=>({'HIGH':0,'MEDIUM':1,'LOW':2}[a.impactLevel]||2)-({'HIGH':0,'MEDIUM':1,'LOW':2}[b.impactLevel]||2))
                  .map((ev,i)=><EventRow key={i} event={ev} />)}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}