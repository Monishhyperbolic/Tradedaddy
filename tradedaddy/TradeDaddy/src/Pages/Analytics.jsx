/**
 * Analytics.jsx — TradeDaddy
 * Full trade analytics: setup win rates, behavioral patterns,
 * PnL breakdown, discipline scoring, emotion heatmap
 */
import { useState, useMemo } from 'react'

const T = {
  bg:'#07050e', card:'rgba(255,255,255,0.025)', border:'rgba(255,255,255,0.08)',
  borderHi:'rgba(255,255,255,0.14)', p:'#5B2EFF', pd:'rgba(91,46,255,0.15)',
  g:'#2ECC8A', gd:'rgba(46,204,138,0.15)', r:'#FF4D6A', rd:'rgba(255,77,106,0.15)',
  a:'#F5A623', ad:'rgba(245,166,35,0.15)', b:'#3B9EFF',
  t:'rgba(255,255,255,0.92)', m:'rgba(255,255,255,0.52)',
  d:'rgba(255,255,255,0.32)', f:'rgba(255,255,255,0.06)',
  font:"'DM Sans','Space Grotesk',sans-serif", mono:"'JetBrains Mono',monospace",
}

const fmtInr = n => {
  if (n == null) return '—'
  const s = n >= 0 ? '+' : '-'
  const abs = Math.abs(n)
  if (abs >= 1e5) return `${s}₹${(abs/1e5).toFixed(2)}L`
  return `${s}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

/* ── Stat tile ── */
function Tile({ label, value, sub, color, icon }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:'18px 20px', position:'relative', overflow:'hidden' }}>
      {icon && <div style={{ position:'absolute', top:16, right:16, fontSize:20, opacity:0.15 }}>{icon}</div>}
      <div style={{ fontSize:11, fontWeight:700, color:T.d, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:800, color:color||T.t, letterSpacing:'-0.02em', marginBottom:3, fontFamily:T.mono }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:T.m }}>{sub}</div>}
    </div>
  )
}

/* ── Horizontal bar ── */
function HBar({ label, value, max, color, sub }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:13, fontWeight:600, color:T.t }}>{label}</span>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {sub && <span style={{ fontSize:11, color:T.d }}>{sub}</span>}
          <span style={{ fontSize:13, fontWeight:700, color, fontFamily:T.mono }}>{value}</span>
        </div>
      </div>
      <div style={{ height:6, background:T.f, borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width 0.6s ease' }}/>
      </div>
    </div>
  )
}

/* ── Section wrapper ── */
function Section({ title, sub, children, action }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18, padding:'22px 24px', marginBottom:18 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:T.t }}>{title}</div>
          {sub && <div style={{ fontSize:12, color:T.m, marginTop:2 }}>{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

/* ── Setup performance table ── */
function SetupTable({ setups }) {
  const sorted = Object.entries(setups).sort((a,b) => b[1].pnl - a[1].pnl)
  if (!sorted.length) return <div style={{ textAlign:'center', padding:'24px', color:T.d, fontSize:13 }}>No setup data yet. Tag your trades with a setup name when logging.</div>

  return (
    <table style={{ width:'100%', borderCollapse:'collapse' }}>
      <thead>
        <tr style={{ borderBottom:`1px solid ${T.border}` }}>
          {['Setup', 'Trades', 'Win Rate', 'Avg PnL', 'Total PnL', 'Avg Disc'].map(h => (
            <th key={h} style={{ padding:'8px 12px', fontSize:10, fontWeight:700, color:T.d, textTransform:'uppercase', letterSpacing:'0.06em', textAlign: h==='Setup'?'left':'right' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map(([setup, d]) => {
          const wr = Math.round((d.wins / d.total) * 100)
          const avgPnl = d.pnl / d.total
          return (
            <tr key={setup} style={{ borderBottom:`1px solid ${T.f}` }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <td style={{ padding:'11px 12px', fontWeight:600, fontSize:14 }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:8, height:8, borderRadius:2, background: wr>=60?T.g:wr>=40?T.a:T.r, flexShrink:0 }}/>
                  {setup}
                </span>
              </td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontSize:13, color:T.m }}>{d.total}</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontWeight:700, fontSize:13, color: wr>=60?T.g:wr>=40?T.a:T.r, fontFamily:T.mono }}>{wr}%</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontSize:13, fontWeight:600, color:avgPnl>=0?T.g:T.r, fontFamily:T.mono }}>{fmtInr(avgPnl)}</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontSize:13, fontWeight:700, color:d.pnl>=0?T.g:T.r, fontFamily:T.mono }}>{fmtInr(d.pnl)}</td>
              <td style={{ padding:'11px 12px', textAlign:'right', fontSize:12, color:d.avgDisc>=80?T.g:d.avgDisc>=60?T.a:T.r }}>{d.avgDisc}/100</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ── Emotion breakdown ── */
function EmotionBreakdown({ trades }) {
  const stats = {}
  trades.forEach(t => {
    const e = t.emotion || '😐'
    if (!stats[e]) stats[e] = { count:0, pnl:0, wins:0 }
    stats[e].count++
    stats[e].pnl += t.pnl || 0
    if ((t.pnl||0) > 0) stats[e].wins++
  })
  const sorted = Object.entries(stats).sort((a,b) => b[1].count - a[1].count)
  const maxCount = Math.max(...sorted.map(([,d])=>d.count), 1)
  const LABELS = { '😊':'Happy','😤':'Frustrated','😐':'Neutral','😰':'Anxious','🤑':'Greedy' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {sorted.map(([e, d]) => {
        const wr = Math.round((d.wins/d.count)*100)
        return (
          <div key={e} style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:22, flexShrink:0 }}>{e}</span>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:12, color:T.m }}>{LABELS[e]||e} · {d.count} trades · {wr}% WR</span>
                <span style={{ fontSize:12, fontWeight:700, color:d.pnl>=0?T.g:T.r, fontFamily:T.mono }}>{fmtInr(d.pnl)}</span>
              </div>
              <div style={{ height:5, background:T.f, borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${(d.count/maxCount)*100}%`, background:wr>=60?T.g:wr>=40?T.a:T.r, borderRadius:3 }}/>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Calendar heatmap (last 12 weeks) ── */
function PnLHeatmap({ trades }) {
  const byDate = {}
  trades.forEach(t => {
    const d = t.date?.slice(0,10)
    if (!d) return
    if (!byDate[d]) byDate[d] = 0
    byDate[d] += t.pnl || 0
  })

  // Build last 84 days
  const days = []
  for (let i = 83; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0,10)
    days.push({ date:key, pnl:byDate[key]||0, hasData:!!byDate[key] })
  }

  const maxAbs = Math.max(...Object.values(byDate).map(Math.abs), 1)

  const getColor = (pnl, hasData) => {
    if (!hasData) return T.f
    const intensity = Math.min(Math.abs(pnl) / maxAbs, 1)
    if (pnl > 0) return `rgba(46,204,138,${0.15 + intensity * 0.75})`
    if (pnl < 0) return `rgba(255,77,106,${0.15 + intensity * 0.75})`
    return T.f
  }

  const weeks = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i+7))

  return (
    <div>
      <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {week.map(day => (
              <div key={day.date} title={`${day.date}${day.hasData?' · '+fmtInr(day.pnl):''}` }
                style={{ width:14, height:14, borderRadius:3, background:getColor(day.pnl, day.hasData), cursor:day.hasData?'pointer':'default', transition:'transform 0.1s', flexShrink:0 }}
                onMouseEnter={e=>{ if(day.hasData) e.target.style.transform='scale(1.3)' }}
                onMouseLeave={e=>{ e.target.style.transform='scale(1)' }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10 }}>
        <span style={{ fontSize:11, color:T.d }}>Less</span>
        {[0.15,0.35,0.55,0.75,0.95].map(o => (
          <div key={o} style={{ width:12, height:12, borderRadius:2, background:`rgba(46,204,138,${o})` }}/>
        ))}
        <span style={{ fontSize:11, color:T.d }}>More profit</span>
        <span style={{ fontSize:11, color:T.d, marginLeft:8 }}>·</span>
        {[0.15,0.55,0.95].map(o => (
          <div key={o} style={{ width:12, height:12, borderRadius:2, background:`rgba(255,77,106,${o})` }}/>
        ))}
        <span style={{ fontSize:11, color:T.d }}>More loss</span>
      </div>
    </div>
  )
}

/* ── Behavioral flags ── */
function BehavioralFlags({ trades }) {
  const flags = []

  // Revenge trading: loss followed immediately by entry < 30 min later
  const sorted = [...trades].sort((a,b) => new Date(a.created_at||a.date) - new Date(b.created_at||b.date))
  let revengeCount = 0
  for (let i=1; i<sorted.length; i++) {
    if ((sorted[i-1].pnl||0) < -500 && (sorted[i].discipline||70) < 65) revengeCount++
  }

  // Overleveraging after loss
  const afterLossHighQty = sorted.filter((t,i) => i>0 && (sorted[i-1].pnl||0)<0 && (t.qty||1) > (sorted[i-1].qty||1)*1.5).length

  // Cut winners early: trades with positive PnL but discipline < 70
  const cutWinners = trades.filter(t => (t.pnl||0) > 0 && (t.discipline||70) < 70).length

  // Low discipline streak
  const lowDiscStreak = (() => {
    let max=0, cur=0
    sorted.forEach(t => { (t.discipline||70)<65 ? (cur++, max=Math.max(max,cur)) : (cur=0) })
    return max
  })()

  // Consecutive losses
  let maxLossStreak=0, curLoss=0
  sorted.forEach(t => { (t.pnl||0)<0 ? (curLoss++, maxLossStreak=Math.max(maxLossStreak,curLoss)) : (curLoss=0) })

  // Best day of week
  const dowPnl = {0:0,1:0,2:0,3:0,4:0,5:0,6:0}
  trades.forEach(t => { const d=new Date(t.date||'').getDay(); if(!isNaN(d)) dowPnl[d]+=(t.pnl||0) })
  const bestDow = Object.entries(dowPnl).sort((a,b)=>b[1]-a[1])[0]
  const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const items = [
    { icon:'😤', label:'Revenge trade signals', value:revengeCount, severity:revengeCount>2?'high':revengeCount>0?'med':'ok', detail:`${revengeCount} trades entered after a large loss with low discipline` },
    { icon:'📈', label:'Overleveraged after loss', value:afterLossHighQty, severity:afterLossHighQty>1?'med':'ok', detail:`${afterLossHighQty} instances of increasing size after a losing trade` },
    { icon:'✂️', label:'Winners cut early', value:cutWinners, severity:cutWinners>3?'med':'ok', detail:`${cutWinners} profitable trades with discipline < 70` },
    { icon:'🔴', label:'Max low-discipline streak', value:`${lowDiscStreak} trades`, severity:lowDiscStreak>3?'high':lowDiscStreak>1?'med':'ok', detail:`Longest run of consecutive low-discipline trades` },
    { icon:'📉', label:'Max losing streak', value:`${maxLossStreak} trades`, severity:maxLossStreak>4?'high':maxLossStreak>2?'med':'ok', detail:`Worst consecutive loss run` },
    { icon:'📅', label:'Best trading day', value:DOW[parseInt(bestDow[0])], severity:'ok', detail:`${fmtInr(bestDow[1])} cumulative PnL on ${DOW[parseInt(bestDow[0])]}s` },
  ]

  const sevColor = { high:T.r, med:T.a, ok:T.g }
  const sevBg    = { high:T.rd, med:T.ad, ok:T.gd }
  const sevBorder= { high:'rgba(255,77,106,0.25)', med:'rgba(245,166,35,0.25)', ok:'rgba(46,204,138,0.25)' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {items.map(item => (
        <div key={item.label} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:sevBg[item.severity], border:`1px solid ${sevBorder[item.severity]}`, borderRadius:12 }}>
          <span style={{ fontSize:20, flexShrink:0 }}>{item.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>{item.label}</div>
            <div style={{ fontSize:11, color:T.m, marginTop:2 }}>{item.detail}</div>
          </div>
          <span style={{ fontSize:14, fontWeight:800, color:sevColor[item.severity], fontFamily:T.mono, flexShrink:0 }}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Monthly PnL bar chart (SVG) ── */
function MonthlyChart({ trades }) {
  const byMonth = {}
  trades.forEach(t => {
    const m = t.date?.slice(0,7)
    if (!m) return
    if (!byMonth[m]) byMonth[m] = 0
    byMonth[m] += t.pnl || 0
  })

  const months = Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).slice(-12)
  if (!months.length) return <div style={{ textAlign:'center', padding:'24px', color:T.d, fontSize:13 }}>No monthly data yet.</div>

  const maxAbs = Math.max(...months.map(([,v]) => Math.abs(v)), 1)
  const W = 500, H = 120, BAR_W = Math.min(36, (W / months.length) - 8)

  return (
    <svg viewBox={`0 0 ${W} ${H + 28}`} style={{ width:'100%', height:'auto', overflow:'visible' }}>
      {/* Zero line */}
      <line x1="0" y1={H/2} x2={W} y2={H/2} stroke={T.border} strokeWidth="1"/>

      {months.map(([month, pnl], i) => {
        const x = (i / months.length) * W + (W / months.length - BAR_W) / 2 + 10
        const barH = (Math.abs(pnl) / maxAbs) * (H/2 - 8)
        const isUp = pnl >= 0
        const y = isUp ? H/2 - barH : H/2
        const label = month.slice(5) + '/' + month.slice(2,4)

        return (
          <g key={month}>
            <rect x={x} y={y} width={BAR_W} height={Math.max(barH, 2)} rx="3"
              fill={isUp ? 'rgba(46,204,138,0.7)' : 'rgba(255,77,106,0.7)'}/>
            <text x={x + BAR_W/2} y={H + 18} textAnchor="middle" fill={T.d} fontSize="9" fontFamily={T.mono}>{label}</text>
            <title>{month}: {fmtInr(pnl)}</title>
          </g>
        )
      })}
    </svg>
  )
}

/* ── Symbol performance ── */
function SymbolTable({ trades }) {
  const bySymbol = {}
  trades.forEach(t => {
    const s = t.symbol
    if (!s) return
    if (!bySymbol[s]) bySymbol[s] = { trades:0, wins:0, pnl:0, type: t.type }
    bySymbol[s].trades++
    bySymbol[s].pnl += t.pnl || 0
    if ((t.pnl||0) > 0) bySymbol[s].wins++
  })

  const sorted = Object.entries(bySymbol).sort((a,b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl)).slice(0, 10)
  if (!sorted.length) return <div style={{ textAlign:'center', padding:'24px', color:T.d, fontSize:13 }}>No symbol data yet.</div>
  const maxAbs = Math.max(...sorted.map(([,d]) => Math.abs(d.pnl)), 1)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {sorted.map(([sym, d]) => {
        const wr = Math.round((d.wins/d.trades)*100)
        return (
          <div key={sym}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontWeight:700, fontSize:14, minWidth:80 }}>{sym}</span>
                <span style={{ fontSize:11, color:T.d }}>{d.trades} trades · {wr}% WR</span>
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:d.pnl>=0?T.g:T.r, fontFamily:T.mono }}>{fmtInr(d.pnl)}</span>
            </div>
            <div style={{ height:5, background:T.f, borderRadius:3, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${(Math.abs(d.pnl)/maxAbs)*100}%`, background:d.pnl>=0?T.g:T.r, borderRadius:3 }}/>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Main component ── */
export default function Analytics({ trades = [] }) {
  const [period, setPeriod] = useState('all')

  const filtered = useMemo(() => {
    if (period === 'all') return trades
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
    return trades.filter(t => new Date(t.date||'') >= cutoff)
  }, [trades, period])

  const stats = useMemo(() => {
    const wins   = filtered.filter(t => (t.pnl||0) > 0)
    const losses = filtered.filter(t => (t.pnl||0) < 0)
    const totalPnL = filtered.reduce((s,t) => s + (t.pnl||0), 0)
    const avgWin   = wins.length   ? wins.reduce((s,t) => s+(t.pnl||0), 0) / wins.length : 0
    const avgLoss  = losses.length ? losses.reduce((s,t) => s+(t.pnl||0), 0) / losses.length : 0
    const rr       = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0
    const avgDisc  = filtered.length ? Math.round(filtered.reduce((s,t) => s+(t.discipline||70), 0) / filtered.length) : 0
    const bestTrade  = [...filtered].sort((a,b) => (b.pnl||0) - (a.pnl||0))[0]
    const worstTrade = [...filtered].sort((a,b) => (a.pnl||0) - (b.pnl||0))[0]

    const setups = {}
    filtered.forEach(t => {
      if (!t.setup) return
      if (!setups[t.setup]) setups[t.setup] = { wins:0, total:0, pnl:0, avgDisc:0, _discSum:0 }
      setups[t.setup].total++
      setups[t.setup].pnl += t.pnl || 0
      setups[t.setup]._discSum += t.discipline || 70
      if ((t.pnl||0) > 0) setups[t.setup].wins++
      setups[t.setup].avgDisc = Math.round(setups[t.setup]._discSum / setups[t.setup].total)
    })

    return { wins, losses, totalPnL, avgWin, avgLoss, rr, avgDisc, setups, bestTrade, worstTrade }
  }, [filtered])

  if (!trades.length) {
    return (
      <div style={{ textAlign:'center', padding:'80px 0', fontFamily:T.font }}>
        <div style={{ fontSize:48, marginBottom:14 }}>📊</div>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:6, color:T.t }}>No trades to analyse</div>
        <div style={{ fontSize:14, color:T.m }}>Log your first trade in the Journal to see analytics here.</div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily:T.font }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:'0 0 4px', fontSize:22, fontWeight:800, letterSpacing:'-0.02em' }}>Analytics</h1>
          <p style={{ margin:0, fontSize:13, color:T.m }}>{filtered.length} trades · {stats.wins.length} wins · {stats.losses.length} losses</p>
        </div>
        <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,0.04)', borderRadius:11, padding:4 }}>
          {[['7d','7 Days'],['30d','30 Days'],['90d','90 Days'],['all','All Time']].map(([v,l]) => (
            <button key={v} onClick={()=>setPeriod(v)} style={{ padding:'7px 14px', border:'none', borderRadius:8, fontFamily:T.font, fontSize:12, fontWeight:period===v?700:400, cursor:'pointer', background:period===v?T.p:'transparent', color:period===v?'#fff':T.m, transition:'all 0.18s' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Top stat tiles */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        <Tile label="Total P&L"   value={fmtInr(stats.totalPnL)} color={stats.totalPnL>=0?T.g:T.r} icon="💰"/>
        <Tile label="Win Rate"    value={`${filtered.length?Math.round(stats.wins.length/filtered.length*100):0}%`} sub={`${stats.wins.length}W / ${stats.losses.length}L`} color={stats.wins.length/Math.max(filtered.length,1)>=0.6?T.g:T.a} icon="🎯"/>
        <Tile label="Risk:Reward" value={stats.rr>0?`${stats.rr.toFixed(2)}:1`:'—'} sub={`Avg win ${fmtInr(stats.avgWin)}`} color={stats.rr>=1.5?T.g:stats.rr>=1?T.a:T.r} icon="⚖️"/>
        <Tile label="Avg Discipline" value={`${stats.avgDisc}/100`} color={stats.avgDisc>=80?T.g:stats.avgDisc>=65?T.a:T.r} icon="🧘"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        <Tile label="Best Trade"  value={fmtInr(stats.bestTrade?.pnl)}  sub={stats.bestTrade?.symbol}  color={T.g} icon="🚀"/>
        <Tile label="Worst Trade" value={fmtInr(stats.worstTrade?.pnl)} sub={stats.worstTrade?.symbol} color={T.r} icon="💥"/>
        <Tile label="Avg Win"     value={fmtInr(stats.avgWin)}   color={T.g} icon="📈"/>
        <Tile label="Avg Loss"    value={fmtInr(stats.avgLoss)}  color={T.r} icon="📉"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
        {/* Setup performance */}
        <div style={{ gridColumn:'span 2' }}>
          <Section title="Setup Performance" sub="Win rate, average PnL, and discipline score per trading setup">
            <SetupTable setups={stats.setups}/>
          </Section>
        </div>

        {/* Monthly PnL */}
        <Section title="Monthly P&L" sub="Last 12 months — green = profit, red = loss">
          <MonthlyChart trades={trades}/>
        </Section>

        {/* PnL heatmap */}
        <Section title="P&L Heatmap" sub="Daily P&L intensity — last 12 weeks">
          <PnLHeatmap trades={trades}/>
        </Section>

        {/* Top symbols */}
        <Section title="Symbol Performance" sub="Top 10 traded symbols by absolute P&L">
          <SymbolTable trades={filtered}/>
        </Section>

        {/* Emotion breakdown */}
        <Section title="Emotion vs Performance" sub="How your emotional state correlates with trading results">
          <EmotionBreakdown trades={filtered}/>
        </Section>

        {/* Behavioral flags */}
        <div style={{ gridColumn:'span 2' }}>
          <Section title="Behavioral Flags" sub="Destructive patterns detected in your trade history">
            <BehavioralFlags trades={filtered}/>
          </Section>
        </div>
      </div>
    </div>
  )
}