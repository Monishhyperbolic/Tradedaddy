/**
 * EconomicCalendar.jsx — TradeDaddy
 * Forex Factory calendar feed + color-coded impact
 */

import { useState, useEffect } from 'react'
import { api } from '../utils/api'

const C = { bg:'#09070f', s:'rgba(255,255,255,0.03)', b:'rgba(255,255,255,0.07)', p:'#5227FF', g:'#34C77B', r:'#FF5C5C', a:'#F59E0B', m:'rgba(255,255,255,0.4)' }

const IMPACT_CFG = {
  HIGH:   { color:'#FF5C5C', bg:'rgba(255,92,92,0.12)',  border:'rgba(255,92,92,0.3)',   dot:'●', label:'High Impact' },
  MEDIUM: { color:'#F59E0B', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)',  dot:'●', label:'Medium Impact' },
  LOW:    { color:'rgba(255,255,255,0.3)', bg:'rgba(255,255,255,0.04)', border:'rgba(255,255,255,0.12)', dot:'○', label:'Low Impact' },
}

const COUNTRY_FLAGS = { USD:'🇺🇸', EUR:'🇪🇺', GBP:'🇬🇧', JPY:'🇯🇵', AUD:'🇦🇺', CAD:'🇨🇦', CHF:'🇨🇭', NZD:'🇳🇿', CNY:'🇨🇳', INR:'🇮🇳', ALL:'🌍' }

function groupByDate(events) {
  const groups = {}
  events.forEach(e => {
    const date = e.date?.slice(0,10) || 'Unknown'
    if (!groups[date]) groups[date] = []
    groups[date].push(e)
  })
  return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b))
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown'
  const d = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-IN', { weekday:'long', month:'short', day:'numeric' })
}

function EventRow({ event }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = IMPACT_CFG[event.impactLevel] || IMPACT_CFG.LOW
  const flag = COUNTRY_FLAGS[event.country] || '🌍'
  const indiaRelevance = event.relevance || event.indianRelevance

  return (
    <>
      <tr onClick={()=>setExpanded(!expanded)}
        style={{ borderBottom:`1px solid ${C.b}`, cursor:'pointer', background: expanded?'rgba(82,39,255,0.06)':'transparent', transition:'background 0.15s' }}
        onMouseEnter={e=>{ if(!expanded) e.currentTarget.style.background='rgba(255,255,255,0.02)' }}
        onMouseLeave={e=>{ if(!expanded) e.currentTarget.style.background='transparent' }}>
        {/* Time */}
        <td style={{ padding:'12px 14px', fontSize:13, color:C.m, whiteSpace:'nowrap' }}>{event.time || '—'}</td>
        {/* Country */}
        <td style={{ padding:'12px 14px', textAlign:'center', fontSize:16 }}>{flag}</td>
        {/* Impact dot */}
        <td style={{ padding:'12px 14px', textAlign:'center' }}>
          <span style={{ color:cfg.color, fontSize:18 }}>{cfg.dot}</span>
        </td>
        {/* Event name */}
        <td style={{ padding:'12px 14px' }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#fff' }}>{event.title || event.name}</div>
          {indiaRelevance === 'HIGH' && (
            <span style={{ fontSize:10, color:'#F59E0B', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>🇮🇳 India Relevant</span>
          )}
        </td>
        {/* Forecast */}
        <td style={{ padding:'12px 14px', textAlign:'right', fontSize:13, color:'rgba(255,255,255,0.7)', whiteSpace:'nowrap' }}>{event.forecast || '—'}</td>
        {/* Previous */}
        <td style={{ padding:'12px 14px', textAlign:'right', fontSize:13, color:C.m, whiteSpace:'nowrap' }}>{event.previous || '—'}</td>
        {/* Actual */}
        <td style={{ padding:'12px 14px', textAlign:'right', fontSize:13, fontWeight:700, whiteSpace:'nowrap' }}>
          {event.actual ? <span style={{ color: event.actual>event.forecast?C.g:C.r }}>{event.actual}</span> : <span style={{ color:'rgba(255,255,255,0.2)' }}>Pending</span>}
        </td>
        {/* Impact label */}
        <td style={{ padding:'12px 14px' }}>
          <span style={{ padding:'3px 9px', borderRadius:999, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`, whiteSpace:'nowrap' }}>
            {cfg.label}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom:`1px solid ${C.b}`, background:'rgba(82,39,255,0.04)' }}>
          <td colSpan={8} style={{ padding:'10px 14px 14px 50px' }}>
            <div style={{ fontSize:13, color:C.m, lineHeight:1.6 }}>
              <strong style={{ color:'rgba(255,255,255,0.7)' }}>What to expect:</strong>{' '}
              {event.description || generateDescription(event)}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function generateDescription(event) {
  const title = event.title || event.name || ''
  if (title.includes('CPI') || title.includes('Inflation')) return 'Inflation data — higher than expected typically bearish for equities, bullish for USD. Watch RBI policy implications for Indian markets.'
  if (title.includes('Non-Farm') || title.includes('Payroll')) return 'US jobs data — strong numbers usually bullish for USD, affects global risk sentiment and FII flows into India.'
  if (title.includes('Fed') || title.includes('FOMC')) return 'Federal Reserve communication — any hawkish signals can trigger FII outflows from emerging markets including India.'
  if (title.includes('RBI')) return 'RBI policy decision — directly impacts Indian banking sector, real estate, and rate-sensitive sectors.'
  if (title.includes('PMI')) return 'Purchasing Managers Index — forward-looking indicator of economic health. Impacts sector rotation decisions.'
  if (title.includes('GDP')) return 'Gross Domestic Product — major macro indicator affecting long-term market direction and FII sentiment.'
  if (title.includes('Interest Rate')) return 'Central bank interest rate decision — major market-moving event. Watch for forward guidance.'
  return 'Economic data release — monitor for deviation from consensus forecast which may cause short-term volatility.'
}

export default function EconomicCalendar() {
  const [events,   setEvents]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [filter,   setFilter]   = useState('ALL')   // ALL, HIGH, MEDIUM, LOW
  const [country,  setCountry]  = useState('ALL')
  const [source,   setSource]   = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await api.getCalendar()
        setEvents(data.events || [])
        setSource(data.source || '')
      } catch(e) { setError(e.message) } finally { setLoading(false) }
    }
    load()
  }, [])

  const filtered = events.filter(e => {
    if (filter !== 'ALL' && e.impactLevel !== filter) return false
    if (country !== 'ALL' && e.country !== country) return false
    return true
  })

  const grouped = groupByDate(filtered)
  const highCount = events.filter(e=>e.impactLevel==='HIGH').length

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ margin:'0 0 4px', fontSize:22, fontWeight:800 }}>Economic Calendar</h1>
          <p style={{ margin:0, fontSize:13, color:C.m }}>
            {events.length} events this week · {highCount} high-impact
            {source && ` · Source: ${source}`}
          </p>
        </div>
      </div>

      {/* Stats */}
      {!loading && events.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          {[
            { l:'Total Events', v:events.length, c:'#fff' },
            { l:'High Impact',  v:events.filter(e=>e.impactLevel==='HIGH').length,   c:C.r },
            { l:'USD Events',   v:events.filter(e=>e.country==='USD').length,        c:'#85C1E9' },
            { l:'India Events', v:events.filter(e=>e.country==='INR'||e.country==='India').length, c:'#F7DC6F' },
          ].map(({l,v,c}) => (
            <div key={l} style={{ background:C.s, border:`1px solid ${C.b}`, borderRadius:12, padding:'12px 16px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:C.m, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>{l}</div>
              <div style={{ fontSize:22, fontWeight:800, color:c }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{ display:'flex', gap:16, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:12, color:C.m }}>Legend:</span>
        {Object.entries(IMPACT_CFG).map(([k,v]) => (
          <div key={k} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ color:v.color, fontSize:16 }}>{v.dot}</span>
            <span style={{ fontSize:12, color:v.color, fontWeight:600 }}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:6 }}>
          {[['ALL','All'],['HIGH','⚡ High'],['MEDIUM','◎ Medium'],['LOW','○ Low']].map(([v,l]) => (
            <button key={v} onClick={()=>setFilter(v)} style={{ padding:'7px 14px', border:'none', borderRadius:10, fontFamily:'inherit', background:filter===v?C.p:'rgba(255,255,255,0.06)', color:filter===v?'#fff':C.m, fontSize:12, fontWeight:filter===v?700:400, cursor:'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ width:1, height:22, background:C.b }} />
        <select value={country} onChange={e=>setCountry(e.target.value)} style={{ padding:'7px 12px', background:'rgba(255,255,255,0.06)', border:`1px solid ${C.b}`, borderRadius:10, color:'#fff', fontSize:12, fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
          <option value="ALL">🌍 All Countries</option>
          {Object.entries(COUNTRY_FLAGS).filter(([k])=>k!=='ALL').map(([code,flag]) => (
            <option key={code} value={code}>{flag} {code}</option>
          ))}
        </select>
      </div>

      {error && <div style={{ padding:'12px 16px', background:'rgba(255,92,92,0.08)', border:'1px solid rgba(255,92,92,0.2)', borderRadius:12, color:C.r, fontSize:13, marginBottom:16 }}>⚠ {error}</div>}

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[...Array(6)].map((_,i) => <div key={i} style={{ height:52, background:C.s, borderRadius:10, opacity:0.4 }} />)}
        </div>
      ) : grouped.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:C.m }}>No events found with current filters.</div>
      ) : (
        grouped.map(([date, events]) => (
          <div key={date} style={{ marginBottom:28 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ fontSize:15, fontWeight:800, color: formatDate(date)==='Today'?C.p:formatDate(date)==='Tomorrow'?C.a:'#fff' }}>
                {formatDate(date)}
              </div>
              <div style={{ fontSize:12, color:C.m }}>{new Date(date).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}</div>
              {events.filter(e=>e.impactLevel==='HIGH').length > 0 && (
                <span style={{ fontSize:11, color:C.r, fontWeight:700 }}>⚡ {events.filter(e=>e.impactLevel==='HIGH').length} high impact</span>
              )}
            </div>
            <div style={{ background:C.s, border:`1px solid ${C.b}`, borderRadius:14, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.b}` }}>
                    {['Time','','Impact','Event','Forecast','Previous','Actual',''].map((h,i) => (
                      <th key={i} style={{ padding:'10px 14px', fontSize:10, fontWeight:700, color:C.m, textTransform:'uppercase', letterSpacing:'0.06em', textAlign: i>=4?'right':'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.sort((a,b) => { const imp = {HIGH:0,MEDIUM:1,LOW:2}; return (imp[a.impactLevel]||2)-(imp[b.impactLevel]||2) })
                    .map((event,i) => <EventRow key={i} event={event} />)}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <div style={{ marginTop:24, padding:'14px 18px', background:C.s, border:`1px solid ${C.b}`, borderRadius:12, fontSize:12, color:C.m }}>
        📅 Calendar data from Forex Factory. High-impact events can cause significant volatility. RBI and US Fed events are most relevant for Indian equity traders. Click any row to see what the event means for Indian markets.
      </div>
    </div>
  )
}