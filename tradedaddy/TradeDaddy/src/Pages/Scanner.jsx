/**
 * Scanner.jsx — TradeDaddy v3
 * 4 categories: Indian, US, Commodities, Forex/Crypto
 * Requires: npm install lightweight-charts
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../utils/api'

const C = { bg:'#09070f', s:'rgba(255,255,255,0.03)', b:'rgba(255,255,255,0.07)',
  p:'#5227FF', g:'#34C77B', r:'#FF5C5C', a:'#F59E0B', t:'rgba(255,255,255,0.85)', m:'rgba(255,255,255,0.4)' }

const CATEGORIES = [
  { id:'indian',      label:'🇮🇳 Indian Stocks',   desc:'NSE · 100+ stocks' },
  { id:'us',          label:'🇺🇸 US Stocks',        desc:'NYSE/NASDAQ · S&P 500' },
  { id:'commodities', label:'🛢 Commodities',       desc:'Gold, Oil, Wheat…' },
  { id:'forex',       label:'💱 Forex & Crypto',   desc:'FX pairs + BTC/ETH' },
]

const SIGNAL_CONFIG = {
  BREAKOUT:      { label:'▲ Breakout',      bg:'rgba(52,199,123,0.15)', color:'#34C77B', border:'rgba(52,199,123,0.35)' },
  BREAKDOWN:     { label:'▼ Breakdown',     bg:'rgba(255,92,92,0.15)',  color:'#FF5C5C', border:'rgba(255,92,92,0.35)' },
  NEAR_BREAKOUT: { label:'◈ Near Breakout', bg:'rgba(245,158,11,0.15)', color:'#F59E0B', border:'rgba(245,158,11,0.35)' },
}

function Badge({ signal }) {
  const cfg = SIGNAL_CONFIG[signal] || SIGNAL_CONFIG.BREAKOUT
  return <span style={{ padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:800, letterSpacing:'0.07em', background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}` }}>{cfg.label}</span>
}

function fmtVol(v) {
  if (!v) return '—'
  if (v >= 1e7) return `${(v/1e7).toFixed(1)}Cr`
  if (v >= 1e5) return `${(v/1e5).toFixed(1)}L`
  if (v >= 1e3) return `${(v/1e3).toFixed(0)}K`
  return v.toLocaleString()
}
function fmtPrice(v, cur) {
  if (!v) return '—'
  const sym = cur === 'INR' ? '₹' : cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : '$'
  return `${sym}${v.toLocaleString('en-IN', { maximumFractionDigits: v > 100 ? 1 : 4 })}`
}

/* ── CANDLESTICK CHART MODAL ── */
function ChartModal({ symbol, onClose }) {
  const containerRef = useRef(null)
  const chartRef     = useRef(null)
  const seriesRef    = useRef({})
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [meta,    setMeta]    = useState(null)
  const [range,   setRange]   = useState('3mo')

  const load = useCallback(async () => {
    if (!symbol || !chartRef.current) return
    setLoading(true); setError(null)
    try {
      const data = await api.getChart(symbol, range, '1d')
      setMeta(data)
      const candles = data.candles.map(c => ({ time:c.time, open:c.open, high:c.high, low:c.low, close:c.close }))
      const vols    = data.candles.map(c => ({ time:c.time, value:c.volume, color: c.close>=c.open ? 'rgba(52,199,123,0.5)':'rgba(255,92,92,0.5)' }))
      const ma20    = []
      for (let i=19; i<data.candles.length; i++) {
        const avg = data.candles.slice(i-19,i+1).reduce((s,c)=>s+c.close,0)/20
        ma20.push({ time: data.candles[i].time, value: +avg.toFixed(2) })
      }
      seriesRef.current.candle?.setData(candles)
      seriesRef.current.vol?.setData(vols)
      seriesRef.current.ma?.setData(ma20)
      chartRef.current.timeScale().fitContent()
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }, [symbol, range])

  useEffect(() => {
    if (!containerRef.current) return
    const loadLightweight = async () => {
      try {
        const LW = await import('lightweight-charts')
        const chart = LW.createChart(containerRef.current, {
          layout:{ background:{color:'transparent'}, textColor:C.m },
          grid:{ vertLines:{color:'rgba(255,255,255,0.04)'}, horzLines:{color:'rgba(255,255,255,0.04)'} },
          crosshair:{ vertLine:{color:'rgba(82,39,255,0.5)',style:3}, horzLine:{color:'rgba(82,39,255,0.5)',style:3} },
          rightPriceScale:{ borderColor:C.b, scaleMargins:{top:0.1,bottom:0.3} },
          timeScale:{ borderColor:C.b, timeVisible:true, secondsVisible:false },
        })
        const candle = chart.addSeries(LW.CandlestickSeries, { upColor:C.g, downColor:C.r, borderUpColor:C.g, borderDownColor:C.r, wickUpColor:C.g, wickDownColor:C.r })
        const vol = chart.addSeries(LW.HistogramSeries, { priceScaleId:'vol', priceFormat:{type:'volume'} })
        chart.priceScale('vol').applyOptions({ scaleMargins:{top:0.82,bottom:0} })
        const ma = chart.addSeries(LW.LineSeries, { color:'rgba(245,158,11,0.8)', lineWidth:1, title:'MA20' })
        chartRef.current = chart
        seriesRef.current = { candle, vol, ma }
        const ro = new ResizeObserver(() => { if(containerRef.current) chart.applyOptions({width:containerRef.current.clientWidth}) })
        ro.observe(containerRef.current)
        load()
        return () => { ro.disconnect(); chart.remove() }
      } catch(e) { setError('lightweight-charts not installed. Run: npm install lightweight-charts'); setLoading(false) }
    }
    loadLightweight()
  }, [])

  useEffect(() => { load() }, [load])

  const changePct = meta ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100) : 0

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
      onClick={e => { if(e.target===e.currentTarget) onClose() }}>
      <div style={{ width:'100%', maxWidth:1000, background:'#0d0b16', border:`1px solid rgba(82,39,255,0.35)`, borderRadius:22, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px 22px', borderBottom:`1px solid ${C.b}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:18, fontWeight:800 }}>{symbol.replace('.NS','').replace('=X','')}</span>
              {meta && <span style={{ fontSize:14, fontWeight:700, color: changePct>=0?C.g:C.r }}>{changePct>=0?'+':''}{changePct.toFixed(2)}%</span>}
              {meta && <span style={{ fontSize:13, fontWeight:600, color:'#fff' }}>{fmtPrice(meta.regularMarketPrice, meta.currency)}</span>}
            </div>
            <div style={{ fontSize:12, color:C.m, marginTop:2 }}>{meta?.name} · {meta?.exchange}</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {['1mo','3mo','6mo','1y'].map(r => (
              <button key={r} onClick={()=>setRange(r)} style={{ padding:'5px 12px', border:'none', borderRadius:8, fontFamily:'inherit', background:range===r?C.p:'rgba(255,255,255,0.06)', color:range===r?'#fff':C.m, fontSize:12, fontWeight:600, cursor:'pointer' }}>{r}</button>
            ))}
            <button onClick={onClose} style={{ padding:'6px 14px', border:`1px solid ${C.b}`, borderRadius:8, background:'transparent', color:C.m, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>✕</button>
          </div>
        </div>
        {error && <div style={{ padding:'12px 20px', color:C.r, fontSize:13 }}>⚠ {error}</div>}
        <div style={{ position:'relative', height:440 }}>
          {loading && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:2 }}><span style={{ color:C.m, fontSize:13 }}>Loading…</span></div>}
          <div ref={containerRef} style={{ width:'100%', height:'100%', opacity:loading?0.15:1, transition:'opacity 0.3s' }} />
        </div>
      </div>
    </div>
  )
}

/* ── SCREENER TABLE ROW ── */
function ScreenerRow({ item, onChart, idx }) {
  const [hov, setHov] = useState(false)
  const up = item.changePct >= 0
  const cfg = SIGNAL_CONFIG[item.signal] || SIGNAL_CONFIG.BREAKOUT

  return (
    <tr onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ borderBottom:`1px solid ${hov?'rgba(82,39,255,0.15)':C.b}`, background: hov?`${cfg.bg}`:'transparent', transition:'all 0.15s', cursor:'default' }}>
      <td style={{ padding:'10px 14px', fontSize:13, color:C.m }}>{idx+1}</td>
      <td style={{ padding:'10px 14px' }}>
        <div style={{ fontWeight:700, fontSize:14 }}>{item.symbol.replace('.NS','').replace('=X','').replace('-USD','')}</div>
        <div style={{ fontSize:11, color:C.m, marginTop:1 }}>{item.name}</div>
      </td>
      <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, fontSize:14 }}>{fmtPrice(item.close, item.currency)}</td>
      <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:700, fontSize:13, color: up?C.g:C.r }}>{up?'+':''}{item.changePct}%</td>
      <td style={{ padding:'10px 14px', textAlign:'right', fontSize:12, color:C.m }}>{fmtVol(item.volume)}</td>
      <td style={{ padding:'10px 14px', textAlign:'right', fontSize:12 }}>
        <span style={{ fontWeight:700, color: item.volumeRatio>=2?C.g:item.volumeRatio>=1.5?C.a:C.t }}>{item.volumeRatio}×</span>
      </td>
      <td style={{ padding:'10px 14px', textAlign:'center' }}><Badge signal={item.signal} /></td>
      {item.signal === 'NEAR_BREAKOUT' && (
        <td style={{ padding:'10px 14px', textAlign:'center', fontSize:12 }}>
          <div style={{ background:'rgba(245,158,11,0.1)', borderRadius:6, padding:'2px 8px', color:C.a }}>
            {item.proximity?.toFixed(1)}% of high
          </div>
        </td>
      )}
      {item.signal !== 'NEAR_BREAKOUT' && (
        <td style={{ padding:'10px 14px', textAlign:'right', fontSize:12, color:C.m }}>
          vs {fmtPrice(item.signal==='BREAKOUT'?item.refHigh:item.refLow, item.currency)}
        </td>
      )}
      <td style={{ padding:'10px 14px' }}>
        <button onClick={()=>onChart(item.symbol)} style={{ padding:'5px 12px', background:'rgba(82,39,255,0.15)', border:`1px solid rgba(82,39,255,0.3)`, borderRadius:7, color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
          📊 Chart
        </button>
      </td>
    </tr>
  )
}

/* ── SIGNAL SECTION ── */
function SignalSection({ title, items, onChart, emptyMsg }) {
  const [expanded, setExpanded] = useState(true)
  if (!items || items.length === 0) return (
    <div style={{ padding:'20px', textAlign:'center', color:C.m, fontSize:13, background:C.s, borderRadius:12, marginBottom:16 }}>
      {emptyMsg}
    </div>
  )
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, cursor:'pointer' }} onClick={()=>setExpanded(!expanded)}>
        <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:C.t }}>{title} <span style={{ color:C.m, fontWeight:400 }}>({items.length})</span></h3>
        <span style={{ color:C.m, fontSize:12 }}>{expanded?'▲':'▼'}</span>
      </div>
      {expanded && (
        <div style={{ background:C.s, border:`1px solid ${C.b}`, borderRadius:14, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.b}` }}>
                {['#','Symbol','Price','Change','Volume','Vol/Avg','Signal','Ref Level','Chart'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', fontSize:11, fontWeight:600, color:C.m, textTransform:'uppercase', letterSpacing:'0.05em', textAlign: h==='Symbol'||h==='#'?'left':'right', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item,i) => <ScreenerRow key={item.symbol} item={item} onChart={onChart} idx={i} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── SEARCH BAR ── */
function CustomSearch({ onChart }) {
  const [sym, setSym] = useState(''), [loading, setLoading] = useState(false), [result, setResult] = useState(null), [err, setErr] = useState('')
  const search = async () => {
    const s = sym.trim().toUpperCase(); if (!s) return
    setLoading(true); setErr(''); setResult(null)
    try {
      const q = s.includes('.')||s.includes('=')||s.includes('-') ? s : `${s}.NS`
      const data = await api.getChart(q, '3mo', '1d')
      const n = data.candles.length
      if (n < 2) { setErr('Not enough data'); return }
      const last = data.candles[n-1], prev = data.candles[n-2]
      const changePct = +((last.close-prev.close)/prev.close*100).toFixed(2)
      const slice = data.candles.slice(Math.max(0,n-21),n-1)
      const rh = Math.max(...slice.map(c=>c.high)), rl = Math.min(...slice.map(c=>c.low))
      const avgVol = slice.reduce((s,c)=>s+c.volume,0)/slice.length
      const vr = last.volume/avgVol
      setResult({ symbol:q, name:q.replace('.NS',''), close:last.close, changePct, volume:last.volume, volumeRatio:+vr.toFixed(2), refHigh:rh, refLow:rl, signal: last.close>rh?'BREAKOUT':last.close<rl?'BREAKDOWN':'NEUTRAL', currency:data.currency||'INR' })
    } catch(e) { setErr(e.message) } finally { setLoading(false) }
  }
  return (
    <div style={{ background:C.s, border:`1px solid ${C.b}`, borderRadius:16, padding:'18px 20px', marginBottom:20 }}>
      <div style={{ fontSize:12, fontWeight:700, color:C.m, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Custom Symbol Lookup</div>
      <div style={{ display:'flex', gap:10 }}>
        <input value={sym} onChange={e=>setSym(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()}
          placeholder="RELIANCE, AAPL, XAUUSD=X, BTC-USD…"
          style={{ flex:1, padding:'10px 14px', background:'rgba(255,255,255,0.05)', border:`1px solid ${C.b}`, borderRadius:10, color:'#fff', fontSize:13, outline:'none', fontFamily:'inherit' }}
          onFocus={e=>e.target.style.borderColor=C.p} onBlur={e=>e.target.style.borderColor=C.b} />
        <button onClick={search} disabled={loading} style={{ padding:'10px 22px', background:C.p, border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:loading?0.6:1 }}>
          {loading?'…':'Scan'}
        </button>
      </div>
      {err && <div style={{ marginTop:8, fontSize:12, color:C.r }}>⚠ {err}</div>}
      {result && (
        <div style={{ marginTop:12, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'rgba(255,255,255,0.03)', borderRadius:10, border:`1px solid ${C.b}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontWeight:700 }}>{result.name}</span>
            <span style={{ fontSize:14, fontWeight:700, color: result.changePct>=0?C.g:C.r }}>{result.changePct>=0?'+':''}{result.changePct}%</span>
            <Badge signal={result.signal !== 'NEUTRAL' ? result.signal : 'NEAR_BREAKOUT'} />
          </div>
          <button onClick={()=>onChart(result.symbol)} style={{ padding:'6px 16px', background:'rgba(82,39,255,0.2)', border:`1px solid rgba(82,39,255,0.3)`, borderRadius:8, color:'#fff', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>📊 Chart</button>
        </div>
      )}
    </div>
  )
}

/* ── MAIN SCANNER PAGE ── */
export default function Scanner() {
  const [cat,         setCat]         = useState('indian')
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [lookback,    setLookback]    = useState(20)
  const [minVol,      setMinVol]      = useState(1.2)
  const [chartSym,    setChartSym]    = useState(null)
  const [signalFilter, setSignalFilter] = useState('ALL')
  const [sortBy,       setSortBy]      = useState('volumeRatio')
  const [scannedAt,   setScannedAt]   = useState(null)

  const scan = async (category = cat) => {
    setLoading(true); setError(null)
    try {
      const result = await api.scan(lookback, minVol, category)
      setData(result); setScannedAt(new Date())
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { scan(cat) }, [cat, lookback, minVol])

  const sortItems = (items) => {
    if (!items) return []
    const s = [...items]
    if (sortBy === 'volumeRatio') return s.sort((a,b) => b.volumeRatio - a.volumeRatio)
    if (sortBy === 'changePct')   return s.sort((a,b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    if (sortBy === 'volume')      return s.sort((a,b) => b.volume - a.volume)
    return s
  }

  const breakouts   = sortItems(data?.breakouts)
  const breakdowns  = sortItems(data?.breakdowns)
  const nearBreakouts = sortItems(data?.nearBreakout)

  const totalSignals = (breakouts?.length||0) + (breakdowns?.length||0) + (nearBreakouts?.length||0)

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:'0 0 4px', fontSize:22, fontWeight:800 }}>Market Scanner</h1>
          <p style={{ margin:0, fontSize:13, color:C.m }}>
            {data ? `Scanned ${data.scannedCount} symbols · ${totalSignals} signals` : 'Scanning…'}
            {scannedAt && ` · ${scannedAt.toLocaleTimeString()}`}
            {data?.cached && ' · cached'}
          </p>
        </div>
        <button onClick={()=>scan(cat)} disabled={loading} style={{ padding:'10px 20px', background:loading?'rgba(82,39,255,0.4)':C.p, border:'none', borderRadius:12, color:'#fff', fontSize:13, fontWeight:700, cursor:loading?'not-allowed':'pointer', fontFamily:'inherit' }}>
          {loading ? '⟳ Scanning…' : '⟳ Rescan'}
        </button>
      </div>

      {/* Category tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:20, overflowX:'auto', paddingBottom:4 }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={()=>setCat(c.id)} style={{
            padding:'10px 18px', border:'none', borderRadius:12, cursor:'pointer', fontFamily:'inherit',
            background: cat===c.id ? C.p : C.s,
            color: cat===c.id ? '#fff' : C.m,
            fontWeight: cat===c.id ? 700 : 400, fontSize:13,
            border: cat===c.id ? 'none' : `1px solid ${C.b}`,
            whiteSpace:'nowrap', flexShrink:0,
            transition:'all 0.2s',
          }}>
            <div>{c.label}</div>
            <div style={{ fontSize:10, opacity:0.65, marginTop:1 }}>{c.desc}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:12, color:C.m, textTransform:'uppercase', letterSpacing:'0.06em' }}>Lookback</span>
          {[10,20,50].map(n => (
            <button key={n} onClick={()=>setLookback(n)} style={{ padding:'5px 12px', border:'none', borderRadius:8, fontFamily:'inherit', background:lookback===n?C.p:'rgba(255,255,255,0.06)', color:lookback===n?'#fff':C.m, fontSize:12, fontWeight:600, cursor:'pointer' }}>{n}D</button>
          ))}
        </div>
        <div style={{ width:1, height:22, background:C.b }} />
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:12, color:C.m, textTransform:'uppercase', letterSpacing:'0.06em' }}>Min Vol</span>
          {[1.0,1.2,1.5,2.0].map(v => (
            <button key={v} onClick={()=>setMinVol(v)} style={{ padding:'5px 12px', border:'none', borderRadius:8, fontFamily:'inherit', background:minVol===v?C.p:'rgba(255,255,255,0.06)', color:minVol===v?'#fff':C.m, fontSize:12, fontWeight:600, cursor:'pointer' }}>{v}×</button>
          ))}
        </div>
        <div style={{ width:1, height:22, background:C.b }} />
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:12, color:C.m, textTransform:'uppercase', letterSpacing:'0.06em' }}>Sort</span>
          {[['volumeRatio','Vol Ratio'],['changePct','Change%'],['volume','Volume']].map(([k,l]) => (
            <button key={k} onClick={()=>setSortBy(k)} style={{ padding:'5px 12px', border:'none', borderRadius:8, fontFamily:'inherit', background:sortBy===k?C.p:'rgba(255,255,255,0.06)', color:sortBy===k?'#fff':C.m, fontSize:12, fontWeight:600, cursor:'pointer' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {data && !loading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          {[
            { l:'Scanned',      v:data.scannedCount,   c:'#fff' },
            { l:'Breakouts',    v:breakouts.length,    c:C.g },
            { l:'Breakdowns',   v:breakdowns.length,   c:C.r },
            { l:'Near Breakout',v:nearBreakouts.length,c:C.a },
          ].map(({l,v,c}) => (
            <div key={l} style={{ background:C.s, border:`1px solid ${C.b}`, borderRadius:12, padding:'12px 16px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:C.m, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>{l}</div>
              <div style={{ fontSize:24, fontWeight:800, color:c }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Custom search */}
      <CustomSearch onViewChart={setChartSym} onChart={setChartSym} />

      {/* Error */}
      {error && <div style={{ padding:'12px 16px', background:'rgba(255,92,92,0.08)', border:'1px solid rgba(255,92,92,0.2)', borderRadius:12, color:C.r, fontSize:13, marginBottom:16 }}>⚠ {error}</div>}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height:48, background:C.s, borderRadius:10, opacity:0.4, animation:'pulse 1.5s infinite' }} />
          ))}
          <div style={{ textAlign:'center', padding:'20px', color:C.m, fontSize:13 }}>
            Scanning {cat} universe — may take 15-30s for first load…
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && data && (
        <>
          <SignalSection
            title="▲ Breakouts"
            items={breakouts}
            onChart={setChartSym}
            emptyMsg={`No breakouts in ${CATEGORIES.find(c=>c.id===cat)?.label} with current filters. Try lowering Min Vol.`}
          />
          <SignalSection
            title="▼ Breakdowns"
            items={breakdowns}
            onChart={setChartSym}
            emptyMsg="No breakdowns detected."
          />
          <SignalSection
            title="◈ Near Breakout (within 2% of 20D high)"
            items={nearBreakouts}
            onChart={setChartSym}
            emptyMsg="No stocks near breakout level."
          />
        </>
      )}

      {chartSym && <ChartModal symbol={chartSym} onClose={()=>setChartSym(null)} />}
    </div>
  )
}