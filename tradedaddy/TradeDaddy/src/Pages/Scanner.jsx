/**
 * Scanner.jsx v4 — Multi-timeframe + 4 asset categories
 * Requires: npm install lightweight-charts
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { scan, getChart } from '../utils/api'

const C = { s:'rgba(255,255,255,0.03)', b:'rgba(255,255,255,0.07)', p:'#5227FF', g:'#34C77B', r:'#FF5C5C', a:'#F59E0B', m:'rgba(255,255,255,0.4)', f:'rgba(255,255,255,0.06)' }

const CATEGORIES = [
  { id:'indian',      label:'🇮🇳 Indian', desc:'100+ NSE stocks' },
  { id:'us',          label:'🇺🇸 US Stocks', desc:'S&P 500 / NASDAQ' },
  { id:'commodities', label:'🛢 Commodities', desc:'Gold, Oil, Wheat…' },
  { id:'forex',       label:'💱 Forex & Crypto', desc:'FX + BTC/ETH' },
]

const TIMEFRAMES = [
  { id:'1m',  label:'1m',  yahooInterval:'1m',  yahooRange:'1d',   scanInterval:'1m',  desc:'Intraday scalp' },
  { id:'15m', label:'15m', yahooInterval:'15m', yahooRange:'5d',   scanInterval:'15m', desc:'Short-term' },
  { id:'1h',  label:'1h',  yahooInterval:'1h',  yahooRange:'1mo',  scanInterval:'1h',  desc:'Swing intraday' },
  { id:'4h',  label:'4h',  yahooInterval:'1h',  yahooRange:'3mo',  scanInterval:'4h',  desc:'Position' },
  { id:'1d',  label:'1D',  yahooInterval:'1d',  yahooRange:'6mo',  scanInterval:'1d',  desc:'Daily trend' },
]

// Chart range combos per timeframe  
const CHART_RANGES = {
  '1m':  ['1d','5d'],
  '15m': ['5d','1mo'],
  '1h':  ['1mo','3mo'],
  '4h':  ['3mo','6mo'],
  '1d':  ['3mo','6mo','1y'],
}

const SIGNALS = {
  BREAKOUT:      { label:'▲ Breakout',       bg:'rgba(52,199,123,0.15)',  color:'#34C77B', border:'rgba(52,199,123,0.35)' },
  BREAKDOWN:     { label:'▼ Breakdown',      bg:'rgba(255,92,92,0.15)',   color:'#FF5C5C', border:'rgba(255,92,92,0.35)' },
  NEAR_BREAKOUT: { label:'◈ Near Breakout',  bg:'rgba(245,158,11,0.15)', color:'#F59E0B', border:'rgba(245,158,11,0.35)' },
}

function Badge({ signal }) {
  const s = SIGNALS[signal] || SIGNALS.BREAKOUT
  return <span style={{ padding:'2px 9px', borderRadius:999, fontSize:10, fontWeight:800, letterSpacing:'0.07em', background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{s.label}</span>
}

function fmt(v, cur) {
  if (v==null) return '—'
  if (!v && v!==0) return '—'
  const s = cur==='INR'?'₹':cur==='EUR'?'€':cur==='GBP'?'£':'$'
  const n = +v
  return `${s}${n.toLocaleString('en-IN',{maximumFractionDigits:n>100?2:4})}`
}
function fmtVol(v) {
  if (!v) return '—'
  if (v>=1e7) return `${(v/1e7).toFixed(1)}Cr`
  if (v>=1e5) return `${(v/1e5).toFixed(1)}L`
  if (v>=1e3) return `${(v/1e3).toFixed(0)}K`
  return `${v}`
}

/* ── Lightweight-charts modal ── */
function ChartModal({ symbol, defaultTf, onClose }) {
  const containerRef = useRef(null)
  const chartRef     = useRef(null)
  const seriesRef    = useRef({})
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [meta,    setMeta]    = useState(null)
  const [tf,      setTf]      = useState(defaultTf || '1d')

  const currentTf = TIMEFRAMES.find(t=>t.id===tf) || TIMEFRAMES[4]

  const loadData = useCallback(async () => {
    if (!chartRef.current) return
    setLoading(true); setError(null)
    try {
      const range = CHART_RANGES[tf]?.[0] || '3mo'
      const data  = await getChart(symbol, range, currentTf.yahooInterval)
      setMeta(data)
      const candles = data.candles.map(c=>({time:c.time,open:c.open,high:c.high,low:c.low,close:c.close}))
      const vols    = data.candles.map(c=>({time:c.time,value:c.volume,color:c.close>=c.open?'rgba(52,199,123,0.5)':'rgba(255,92,92,0.5)'}))
      // MA20
      const ma20 = []
      for(let i=19;i<data.candles.length;i++){
        ma20.push({time:data.candles[i].time,value:+(data.candles.slice(i-19,i+1).reduce((s,c)=>s+c.close,0)/20).toFixed(4)})
      }
      seriesRef.current.c?.setData(candles)
      seriesRef.current.v?.setData(vols)
      seriesRef.current.m?.setData(ma20)
      chartRef.current.timeScale().fitContent()
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }, [symbol, tf])

  useEffect(() => {
    if (!containerRef.current) return
    let cleanup = ()=>{}
    const init = async () => {
      try {
        const LW = await import('lightweight-charts')
        const chart = LW.createChart(containerRef.current, {
          layout:{background:{color:'transparent'},textColor:C.m},
          grid:{vertLines:{color:C.f},horzLines:{color:C.f}},
          crosshair:{vertLine:{color:'rgba(82,39,255,0.5)',style:3},horzLine:{color:'rgba(82,39,255,0.5)',style:3}},
          rightPriceScale:{borderColor:C.b,scaleMargins:{top:0.08,bottom:0.28}},
          timeScale:{borderColor:C.b,timeVisible:true,secondsVisible:false},
        })
        const c = chart.addSeries(LW.CandlestickSeries,{upColor:C.g,downColor:C.r,borderUpColor:C.g,borderDownColor:C.r,wickUpColor:C.g,wickDownColor:C.r})
        const v = chart.addSeries(LW.HistogramSeries,{priceScaleId:'vol',priceFormat:{type:'volume'}})
        chart.priceScale('vol').applyOptions({scaleMargins:{top:0.82,bottom:0}})
        const m = chart.addSeries(LW.LineSeries,{color:'rgba(245,158,11,0.8)',lineWidth:1,title:'MA20'})
        chartRef.current = chart
        seriesRef.current = {c,v,m}
        const ro = new ResizeObserver(()=>{ if(containerRef.current) chart.applyOptions({width:containerRef.current.clientWidth}) })
        ro.observe(containerRef.current)
        loadData()
        cleanup = ()=>{ ro.disconnect(); chart.remove() }
      } catch(e) { setError('Run: npm install lightweight-charts'); setLoading(false) }
    }
    init()
    return () => cleanup()
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const chg = meta ? ((meta.regularMarketPrice-meta.previousClose)/meta.previousClose*100) : 0

  return (
    <div style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.9)',backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <div style={{ width:'100%',maxWidth:1020,background:'#0d0b16',border:'1px solid rgba(82,39,255,0.35)',borderRadius:22,overflow:'hidden',display:'flex',flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding:'14px 20px',borderBottom:`1px solid ${C.b}`,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <span style={{ fontSize:18,fontWeight:800 }}>{symbol.replace('.NS','').replace('=X','').replace('-USD','')}</span>
              {meta && <span style={{ fontSize:14,fontWeight:700,color:chg>=0?C.g:C.r }}>{chg>=0?'+':''}{chg.toFixed(2)}%</span>}
              {meta && <span style={{ fontSize:13,fontWeight:600 }}>{fmt(meta.regularMarketPrice,meta.currency)}</span>}
            </div>
            <div style={{ fontSize:11,color:C.m,marginTop:2 }}>{meta?.name} · {meta?.exchange}</div>
          </div>
          <div style={{ display:'flex',gap:6,alignItems:'center' }}>
            {/* Timeframe switcher in chart */}
            {TIMEFRAMES.map(t=>(
              <button key={t.id} onClick={()=>setTf(t.id)} style={{ padding:'5px 11px',border:'none',borderRadius:8,fontFamily:'inherit',background:tf===t.id?C.p:'rgba(255,255,255,0.07)',color:tf===t.id?'#fff':C.m,fontSize:12,fontWeight:tf===t.id?700:400,cursor:'pointer' }}>{t.label}</button>
            ))}
            <button onClick={onClose} style={{ padding:'6px 14px',border:`1px solid ${C.b}`,borderRadius:8,background:'transparent',color:C.m,cursor:'pointer',fontSize:12,fontFamily:'inherit',marginLeft:6 }}>✕</button>
          </div>
        </div>
        {/* Legend */}
        <div style={{ padding:'6px 20px',display:'flex',gap:16,borderBottom:`1px solid ${C.f}` }}>
          {[[C.g,'Bullish'],[C.r,'Bearish'],['rgba(245,158,11,0.8)','MA 20']].map(([col,lbl])=>(
            <div key={lbl} style={{ display:'flex',alignItems:'center',gap:5 }}>
              <div style={{ width:14,height:3,background:col,borderRadius:2 }} />
              <span style={{ fontSize:10,color:C.m }}>{lbl}</span>
            </div>
          ))}
          <span style={{ fontSize:10,color:C.m,marginLeft:'auto' }}>Timeframe: {currentTf.label} · {currentTf.desc}</span>
        </div>
        {error && <div style={{ padding:'10px 20px',color:C.r,fontSize:13 }}>⚠ {error}</div>}
        <div style={{ position:'relative',height:440 }}>
          {loading && <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:2 }}><span style={{ color:C.m,fontSize:13 }}>Loading {currentTf.label} data…</span></div>}
          <div ref={containerRef} style={{ width:'100%',height:'100%',opacity:loading?0.1:1,transition:'opacity 0.3s' }} />
        </div>
      </div>
    </div>
  )
}

/* ── Screener table row ── */
function Row({ item, onChart, idx }) {
  const [hov, setHov] = useState(false)
  const up = item.changePct >= 0
  const s  = SIGNALS[item.signal] || SIGNALS.BREAKOUT
  return (
    <tr onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ borderBottom:`1px solid ${hov?'rgba(82,39,255,0.15)':C.b}`,background:hov?s.bg:'transparent',transition:'all 0.12s',cursor:'default' }}>
      <td style={{ padding:'9px 12px',fontSize:13,color:C.m }}>{idx+1}</td>
      <td style={{ padding:'9px 12px' }}>
        <div style={{ fontWeight:700,fontSize:14 }}>{item.symbol.replace('.NS','').replace('=X','').replace('-USD','')}</div>
        <div style={{ fontSize:11,color:C.m,marginTop:1 }}>{item.name}</div>
      </td>
      <td style={{ padding:'9px 12px',textAlign:'right',fontWeight:700,fontSize:14 }}>{fmt(item.close,item.currency)}</td>
      <td style={{ padding:'9px 12px',textAlign:'right',fontWeight:700,fontSize:13,color:up?C.g:C.r }}>{up?'+':''}{item.changePct}%</td>
      <td style={{ padding:'9px 12px',textAlign:'right',fontSize:12,color:C.m }}>{fmtVol(item.volume)}</td>
      <td style={{ padding:'9px 12px',textAlign:'right',fontSize:12 }}>
        <span style={{ fontWeight:700,color:item.volumeRatio>=2?C.g:item.volumeRatio>=1.5?C.a:'#fff' }}>{item.volumeRatio}×</span>
      </td>
      <td style={{ padding:'9px 12px',textAlign:'center' }}><Badge signal={item.signal} /></td>
      <td style={{ padding:'9px 12px',textAlign:'right',fontSize:11,color:C.m }}>
        {item.signal==='NEAR_BREAKOUT'
          ? <span style={{ color:C.a }}>{item.proximity?.toFixed(1)}% of high</span>
          : fmt(item.signal==='BREAKOUT'?item.refHigh:item.refLow,item.currency)}
      </td>
      <td style={{ padding:'9px 12px',textAlign:'center' }}>
        {item.closePosition != null && (
          <div title={`Close position in day range: ${(item.closePosition*100).toFixed(0)}%`}
            style={{ width:32,height:8,background:'rgba(255,255,255,0.08)',borderRadius:3,overflow:'hidden',display:'inline-block',verticalAlign:'middle' }}>
            <div style={{ height:'100%',width:`${item.closePosition*100}%`,background:item.signal==='BREAKOUT'?C.g:item.signal==='BREAKDOWN'?C.r:C.a,borderRadius:3 }}/>
          </div>
        )}
      </td>
      <td style={{ padding:'9px 12px' }}>
        <button onClick={()=>onChart(item.symbol)} style={{ padding:'4px 10px',background:'rgba(82,39,255,0.15)',border:'1px solid rgba(82,39,255,0.3)',borderRadius:7,color:'#fff',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap' }}>📊 Chart</button>
      </td>
    </tr>
  )
}

/* ── Signal section ── */
function Section({ title, items, onChart, emptyMsg }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ marginBottom:22 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,cursor:'pointer' }} onClick={()=>setOpen(v=>!v)}>
        <h3 style={{ margin:0,fontSize:14,fontWeight:700 }}>{title} <span style={{ color:C.m,fontWeight:400 }}>({items?.length||0})</span></h3>
        <span style={{ fontSize:12,color:C.m }}>{open?'▲':'▼'}</span>
      </div>
      {open && (!items?.length ? (
        <div style={{ padding:'16px',textAlign:'center',color:C.m,fontSize:13,background:C.s,borderRadius:12 }}>{emptyMsg}</div>
      ) : (
        <div style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:14,overflow:'hidden' }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.b}` }}>
                {['#','Symbol','Price','Change','Volume','Vol/Avg','Signal','Ref Level','Range Pos','Chart'].map(h=>(
                  <th key={h} style={{ padding:'9px 12px',fontSize:10,fontWeight:700,color:C.m,textTransform:'uppercase',letterSpacing:'0.05em',textAlign:['#','Symbol','Signal','Chart'].includes(h)?'left':'right',whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{items.map((item,i)=><Row key={item.symbol} item={item} onChart={onChart} idx={i} />)}</tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

/* ── Custom lookup ── */
function Lookup({ onChart, activeTf }) {
  const [sym, setSym] = useState(''), [loading, setLoading] = useState(false), [res, setRes] = useState(null), [err, setErr] = useState('')
  const tf = TIMEFRAMES.find(t=>t.id===activeTf)||TIMEFRAMES[4]

  const search = async () => {
    const s = sym.trim().toUpperCase(); if(!s) return
    setLoading(true); setErr(''); setRes(null)
    try {
      const q = (s.includes('.')||s.includes('=')||s.includes('-'))?s:`${s}.NS`
      const data = await getChart(q, CHART_RANGES[activeTf]?.[0]||'3mo', tf.yahooInterval)
      const n=data.candles.length; if(n<2){setErr('Not enough data');return}
      const last=data.candles[n-1], prev=data.candles[n-2]
      const chg=+((last.close-prev.close)/prev.close*100).toFixed(2)
      const sl=data.candles.slice(Math.max(0,n-21),n-1)
      const rh=Math.max(...sl.map(c=>c.high)), rl=Math.min(...sl.map(c=>c.low))
      const avgVol=sl.reduce((s,c)=>s+c.volume,0)/sl.length, vr=last.volume/avgVol
      setRes({symbol:q,name:q.replace('.NS',''),close:last.close,changePct:chg,volume:last.volume,volumeRatio:+vr.toFixed(2),refHigh:rh,refLow:rl,signal:last.close>rh?'BREAKOUT':last.close<rl?'BREAKDOWN':'NEUTRAL',currency:data.currency||'INR'})
    } catch(e){setErr(e.message)} finally{setLoading(false)}
  }
  return (
    <div style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:16,padding:'16px 18px',marginBottom:18 }}>
      <div style={{ fontSize:11,fontWeight:700,color:C.m,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10 }}>Custom Lookup ({tf.label} · {tf.desc})</div>
      <div style={{ display:'flex',gap:10 }}>
        <input value={sym} onChange={e=>setSym(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="RELIANCE, AAPL, XAUUSD=X, BTC-USD…"
          style={{ flex:1,padding:'9px 14px',background:'rgba(255,255,255,0.05)',border:`1px solid ${C.b}`,borderRadius:10,color:'#fff',fontSize:13,outline:'none',fontFamily:'inherit' }}
          onFocus={e=>e.target.style.borderColor=C.p} onBlur={e=>e.target.style.borderColor=C.b} />
        <button onClick={search} disabled={loading} style={{ padding:'9px 20px',background:C.p,border:'none',borderRadius:10,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:loading?0.6:1 }}>{loading?'…':'Scan'}</button>
      </div>
      {err && <div style={{ marginTop:7,fontSize:12,color:C.r }}>⚠ {err}</div>}
      {res && (
        <div style={{ marginTop:12,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'rgba(255,255,255,0.03)',borderRadius:10,border:`1px solid ${C.b}` }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <span style={{ fontWeight:700 }}>{res.name}</span>
            <span style={{ fontWeight:700,color:res.changePct>=0?C.g:C.r }}>{res.changePct>=0?'+':''}{res.changePct}%</span>
            <Badge signal={res.signal!=='NEUTRAL'?res.signal:'NEAR_BREAKOUT'} />
          </div>
          <button onClick={()=>onChart(res.symbol)} style={{ padding:'5px 14px',background:'rgba(82,39,255,0.2)',border:'1px solid rgba(82,39,255,0.3)',borderRadius:8,color:'#fff',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>📊 Chart</button>
        </div>
      )}
    </div>
  )
}

export default function Scanner() {
  const [cat,       setCat]     = useState('indian')
  const [tf,        setTf]      = useState('1d')
  const [data,      setData]    = useState(null)
  const [loading,   setLoading] = useState(false)
  const [error,     setError]   = useState(null)
  const [lookback,  setLookback]= useState(20)
  const [minVol,    setMinVol]  = useState(1.2)
  const [chartSym,  setChartSym]= useState(null)
  const [sortBy,    setSortBy]  = useState('volumeRatio')
  const [ts,        setTs]      = useState(null)

  const doScan = async (category=cat, interval=tf) => {
    setLoading(true); setError(null)
    try {
      const res = await scan(lookback, minVol, category, interval)
      setData(res); setTs(new Date())
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { doScan(cat, tf) }, [cat, tf, lookback, minVol])

  const sort = items => {
    if (!items) return []
    const s=[...items]
    if (sortBy==='volumeRatio') return s.sort((a,b)=>b.volumeRatio-a.volumeRatio)
    if (sortBy==='changePct')   return s.sort((a,b)=>Math.abs(b.changePct)-Math.abs(a.changePct))
    return s
  }

  const breakouts    = sort(data?.breakouts)
  const breakdowns   = sort(data?.breakdowns)
  const nearBreakout = sort(data?.nearBreakout)
  const total = (breakouts?.length||0)+(breakdowns?.length||0)+(nearBreakout?.length||0)

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20 }}>
        <div>
          <h1 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800 }}>Market Scanner</h1>
          <p style={{ margin:0,fontSize:13,color:C.m }}>
            {data?`Scanned ${data.scannedCount} symbols · ${total} signals`:'Ready to scan'}
            {ts&&` · ${ts.toLocaleTimeString()}`}{data?.cached&&' · cached'}
          </p>
        </div>
        <button onClick={()=>doScan(cat,tf)} disabled={loading} style={{ padding:'10px 20px',background:loading?'rgba(82,39,255,0.4)':C.p,border:'none',borderRadius:12,color:'#fff',fontSize:13,fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:'inherit' }}>
          {loading?'⟳ Scanning…':'⟳ Rescan'}
        </button>
      </div>

      {/* Asset category tabs */}
      <div style={{ display:'flex',gap:8,marginBottom:16,overflowX:'auto',paddingBottom:4 }}>
        {CATEGORIES.map(c=>(
          <button key={c.id} onClick={()=>setCat(c.id)} style={{ padding:'9px 16px',border:'none',borderRadius:12,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',flexShrink:0,transition:'all 0.2s',background:cat===c.id?C.p:C.s,color:cat===c.id?'#fff':C.m,fontWeight:cat===c.id?700:400,fontSize:13,border:cat===c.id?'none':`1px solid ${C.b}` }}>
            <div style={{ fontSize:13 }}>{c.label}</div>
            <div style={{ fontSize:10,opacity:0.6,marginTop:1 }}>{c.desc}</div>
          </button>
        ))}
      </div>

      {/* TIMEFRAME tabs */}
      <div style={{ display:'flex',gap:6,marginBottom:18,alignItems:'center' }}>
        <span style={{ fontSize:11,color:C.m,textTransform:'uppercase',letterSpacing:'0.07em',marginRight:4 }}>Timeframe:</span>
        {TIMEFRAMES.map(t=>(
          <button key={t.id} onClick={()=>setTf(t.id)} style={{ padding:'6px 16px',border:'none',borderRadius:9,fontFamily:'inherit',cursor:'pointer',transition:'all 0.2s',background:tf===t.id?C.p:'rgba(255,255,255,0.07)',color:tf===t.id?'#fff':C.m,fontWeight:tf===t.id?700:400,fontSize:13,border:tf===t.id?'none':`1px solid ${C.b}` }}>
            {t.label}
            <span style={{ fontSize:9,display:'block',opacity:0.6,marginTop:1 }}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div style={{ display:'flex',gap:10,marginBottom:18,flexWrap:'wrap',alignItems:'center' }}>
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <span style={{ fontSize:11,color:C.m,textTransform:'uppercase',letterSpacing:'0.06em' }}>Lookback</span>
          {[10,20,50].map(n=>(
            <button key={n} onClick={()=>setLookback(n)} style={{ padding:'5px 11px',border:'none',borderRadius:8,fontFamily:'inherit',background:lookback===n?C.p:'rgba(255,255,255,0.06)',color:lookback===n?'#fff':C.m,fontSize:12,fontWeight:600,cursor:'pointer' }}>{n}</button>
          ))}
        </div>
        <div style={{ width:1,height:20,background:C.b }} />
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <span style={{ fontSize:11,color:C.m,textTransform:'uppercase',letterSpacing:'0.06em' }}>Min Vol</span>
          {[1.0,1.2,1.5,2.0].map(v=>(
            <button key={v} onClick={()=>setMinVol(v)} style={{ padding:'5px 11px',border:'none',borderRadius:8,fontFamily:'inherit',background:minVol===v?C.p:'rgba(255,255,255,0.06)',color:minVol===v?'#fff':C.m,fontSize:12,fontWeight:600,cursor:'pointer' }}>{v}×</button>
          ))}
        </div>
        <div style={{ width:1,height:20,background:C.b }} />
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <span style={{ fontSize:11,color:C.m,textTransform:'uppercase',letterSpacing:'0.06em' }}>Sort</span>
          {[['volumeRatio','Vol Ratio'],['changePct','Change%']].map(([k,l])=>(
            <button key={k} onClick={()=>setSortBy(k)} style={{ padding:'5px 11px',border:'none',borderRadius:8,fontFamily:'inherit',background:sortBy===k?C.p:'rgba(255,255,255,0.06)',color:sortBy===k?'#fff':C.m,fontSize:12,fontWeight:600,cursor:'pointer' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {data && !loading && (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:18 }}>
          {[['Scanned',data.scannedCount,'#fff'],['Breakouts',breakouts?.length||0,C.g],['Breakdowns',breakdowns?.length||0,C.r],['Near Breakout',nearBreakout?.length||0,C.a]].map(([l,v,c])=>(
            <div key={l} style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:12,padding:'11px 14px',textAlign:'center' }}>
              <div style={{ fontSize:10,color:C.m,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3 }}>{l}</div>
              <div style={{ fontSize:22,fontWeight:800,color:c }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Custom lookup */}
      <Lookup onChart={setChartSym} activeTf={tf} />

      {/* Note for intraday */}
      {(tf==='1m'||tf==='15m') && (
        <div style={{ padding:'10px 14px',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:12,fontSize:12,color:C.a,marginBottom:16 }}>
          ⏱ {tf==='1m'?'1-minute':'15-minute'} data is only available during market hours. US markets: 9:30 PM–4 AM IST. NSE: 9:15 AM–3:30 PM IST. Outside hours, last session's data is shown.
        </div>
      )}

      {error && <div style={{ padding:'12px 14px',background:'rgba(255,92,92,0.08)',border:'1px solid rgba(255,92,92,0.2)',borderRadius:12,color:C.r,fontSize:13,marginBottom:14 }}>⚠ {error} — Worker may need redeployment or Yahoo Finance rate limit hit. Try in 30s.</div>}

      {loading ? (
        <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
          {[...Array(4)].map((_,i)=><div key={i} style={{ height:44,background:C.s,borderRadius:10,opacity:0.4 }} />)}
          <div style={{ textAlign:'center',padding:'20px',color:C.m,fontSize:13 }}>Scanning {data?.scannedCount||'…'} {CATEGORIES.find(c=>c.id===cat)?.label} symbols on {tf} timeframe…</div>
        </div>
      ) : (
        <>
          <Section title="▲ Breakouts"     items={breakouts}    onChart={setChartSym} emptyMsg={`No ${tf} breakouts in ${cat} with current filters.`} />
          <Section title="▼ Breakdowns"    items={breakdowns}   onChart={setChartSym} emptyMsg="No breakdowns detected." />
          <Section title="◈ Near Breakout (within 2%)" items={nearBreakout} onChart={setChartSym} emptyMsg="No stocks near breakout level." />
        </>
      )}

      {chartSym && <ChartModal symbol={chartSym} defaultTf={tf} onClose={()=>setChartSym(null)} />}
    </div>
  )
}