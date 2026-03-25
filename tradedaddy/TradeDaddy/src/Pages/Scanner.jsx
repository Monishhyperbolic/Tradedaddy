/**
 * Scanner.jsx
 * Requires: npm install lightweight-charts
 * Uses Yahoo Finance (free, no API key) via the Worker proxy
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import { api } from '../utils/api'

/* ── Color constants ── */
const C = {
  bg:      '#09070f',
  surface: 'rgba(255,255,255,0.03)',
  border:  'rgba(255,255,255,0.07)',
  purple:  '#5227FF',
  green:   '#34C77B',
  red:     '#FF5C5C',
  amber:   '#F59E0B',
  text:    'rgba(255,255,255,0.85)',
  muted:   'rgba(255,255,255,0.4)',
  faint:   'rgba(255,255,255,0.07)',
}

/* ── Helpers ── */
const fmtVol = (v) => {
  if (!v) return '—'
  if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`
  return v.toLocaleString()
}
const fmtPrice = (v, cur = 'INR') =>
  cur === 'INR' ? `₹${v?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : `$${v?.toFixed(2)}`

/* ── SignalBadge ── */
function Badge({ signal }) {
  const isUp = signal === 'BREAKOUT'
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      background: isUp ? 'rgba(52,199,123,0.15)' : 'rgba(255,92,92,0.15)',
      color: isUp ? C.green : C.red,
      border: `1px solid ${isUp ? 'rgba(52,199,123,0.3)' : 'rgba(255,92,92,0.3)'}`,
    }}>
      {isUp ? '▲ Breakout' : '▼ Breakdown'}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────────
   CANDLESTICK CHART COMPONENT
   Uses lightweight-charts (TradingView — free & open source)
───────────────────────────────────────────────────────────────── */
function CandleChart({ symbol, onClose }) {
  const containerRef  = useRef(null)
  const chartRef      = useRef(null)
  const candleSerRef  = useRef(null)
  const volSerRef     = useRef(null)
  const ma20Ref       = useRef(null)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState(null)
  const [meta,    setMeta]      = useState(null)
  const [range,   setRange]     = useState('3mo')

  const RANGES = ['1mo', '3mo', '6mo', '1y']

  const loadChart = useCallback(async () => {
    if (!symbol) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.getChart(symbol, range, '1d')
      setMeta(data)

      const candles = data.candles.map(c => ({
        time:  c.time,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      }))

      const volumes = data.candles.map(c => ({
        time:  c.time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(52,199,123,0.5)' : 'rgba(255,92,92,0.5)',
      }))

      // Calculate 20-day MA
      const ma20 = []
      for (let i = 19; i < data.candles.length; i++) {
        const avg = data.candles.slice(i - 19, i + 1).reduce((s, c) => s + c.close, 0) / 20
        ma20.push({ time: data.candles[i].time, value: +avg.toFixed(2) })
      }

      if (candleSerRef.current) candleSerRef.current.setData(candles)
      if (volSerRef.current)    volSerRef.current.setData(volumes)
      if (ma20Ref.current)      ma20Ref.current.setData(ma20)

      chartRef.current?.timeScale().fitContent()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [symbol, range])

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background:  { color: 'transparent' },
        textColor:   C.muted,
      },
      grid: {
        vertLines:   { color: C.faint },
        horzLines:   { color: C.faint },
      },
      crosshair: {
        vertLine: { color: 'rgba(82,39,255,0.5)', width: 1, style: 3 },
        horzLine: { color: 'rgba(82,39,255,0.5)', width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: C.border,
        scaleMargins: { top: 0.1, bottom: 0.3 },
      },
      timeScale: {
        borderColor: C.border,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale:  true,
      handleScroll: true,
    })

    // Candlestick series
    const candleSer = chart.addSeries(CandlestickSeries, {
      upColor:         C.green,
      downColor:       C.red,
      borderUpColor:   C.green,
      borderDownColor: C.red,
      wickUpColor:     C.green,
      wickDownColor:   C.red,
    })

    // Volume histogram (separate pane via price scale)
    const volSer = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat:  { type: 'volume' },
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    // 20-day MA line
    const ma20 = chart.addSeries(LineSeries, {
      color:       'rgba(245,158,11,0.8)',
      lineWidth:   1,
      lineStyle:   0,
      title:       'MA20',
    })

    chartRef.current     = chart
    candleSerRef.current = candleSer
    volSerRef.current    = volSer
    ma20Ref.current      = ma20

    const ro = new ResizeObserver(() => {
      if (containerRef.current)
        chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [])

  useEffect(() => { loadChart() }, [loadChart])

  const change   = meta ? (meta.regularMarketPrice - meta.previousClose) : 0
  const changePct = meta?.previousClose ? (change / meta.previousClose) * 100 : 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 960, background: '#0d0b16',
        border: `1px solid rgba(82,39,255,0.3)`,
        borderRadius: 20, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                  {symbol.replace('.NS', '').replace('=X', '')}
                </span>
                {meta && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: changePct >= 0 ? C.green : C.red }}>
                    {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {meta?.name || symbol} · {meta?.exchange || ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Range selector */}
            <div style={{ display: 'flex', gap: 4 }}>
              {RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    padding: '5px 12px', border: 'none', borderRadius: 8,
                    background: range === r ? C.purple : 'rgba(255,255,255,0.06)',
                    color: range === r ? '#fff' : C.muted,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              style={{ padding: '6px 14px', border: `1px solid ${C.border}`, borderRadius: 8, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ padding: '8px 24px', display: 'flex', gap: 20, borderBottom: `1px solid ${C.faint}` }}>
          {[
            { color: C.green,  label: 'Bullish candle' },
            { color: C.red,    label: 'Bearish candle' },
            { color: '#F59E0B',label: 'MA 20' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 3, background: color, borderRadius: 2 }} />
              <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{ position: 'relative', height: 440, padding: '8px 0' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
              <div style={{ fontSize: 13, color: C.muted }}>Loading chart data…</div>
            </div>
          )}
          {error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
              <div style={{ fontSize: 13, color: C.red }}>⚠ {error}</div>
            </div>
          )}
          <div ref={containerRef} style={{ width: '100%', height: '100%', opacity: loading ? 0.2 : 1, transition: 'opacity 0.3s' }} />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   SIGNAL CARD
───────────────────────────────────────────────────────────────── */
function SignalCard({ data, onViewChart }) {
  const isUp = data.signal === 'BREAKOUT'
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:  hovered ? (isUp ? 'rgba(52,199,123,0.06)' : 'rgba(255,92,92,0.06)') : C.surface,
        border:      `1px solid ${hovered ? (isUp ? 'rgba(52,199,123,0.3)' : 'rgba(255,92,92,0.3)') : C.border}`,
        borderRadius: 16,
        padding:     '18px 20px',
        cursor:      'default',
        transition:  'all 0.2s',
        position:    'relative',
        overflow:    'hidden',
      }}
    >
      {/* Glow */}
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 100, height: 100,
        background: `radial-gradient(circle, ${isUp ? 'rgba(52,199,123,0.1)' : 'rgba(255,92,92,0.1)'} 0%, transparent 70%)`,
        borderRadius: '50%', pointerEvents: 'none',
        opacity: hovered ? 1 : 0, transition: 'opacity 0.3s',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{data.name}</div>
          <Badge signal={data.signal} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
            {data.currency === 'INR' ? '₹' : '$'}{data.close?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: data.changePct >= 0 ? C.green : C.red, marginTop: 2 }}>
            {data.changePct >= 0 ? '+' : ''}{data.changePct}%
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Volume',     value: fmtVol(data.volume) },
          { label: 'Vol Ratio',  value: `${data.volumeRatio}×` },
          { label: isUp ? '20D High' : '20D Low', value: data.currency === 'INR' ? `₹${(isUp ? data.refHigh : data.refLow)?.toLocaleString('en-IN')}` : `$${(isUp ? data.refHigh : data.refLow)?.toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Volume bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: C.muted }}>Volume vs average</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: isUp ? C.green : C.red }}>{data.volumeRatio}× avg</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${Math.min(data.volumeRatio * 33, 100)}%`,
            background: isUp ? C.green : C.red,
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      <button
        onClick={() => onViewChart(data.symbol)}
        style={{
          width: '100%', padding: '10px 0', border: `1px solid ${C.border}`,
          borderRadius: 10, background: 'rgba(255,255,255,0.04)',
          color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
          letterSpacing: '0.02em',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = `rgba(82,39,255,0.2)`; e.currentTarget.style.borderColor = 'rgba(82,39,255,0.4)'; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
      >
        📊 View Chart
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   CUSTOM SYMBOL SEARCH
───────────────────────────────────────────────────────────────── */
function SymbolSearch({ onViewChart }) {
  const [symbol, setSymbol] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const search = async () => {
    const sym = symbol.trim().toUpperCase()
    if (!sym) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      // Add .NS if no suffix (assume NSE)
      const querySym = sym.includes('.') || sym.includes('=') ? sym : `${sym}.NS`
      const data = await api.getChart(querySym, '3mo', '1d')
      const candles = data.candles
      const n = candles.length
      if (n < 2) { setError('Not enough data'); return }

      const lastClose = candles[n-1].close
      const prevClose = candles[n-2].close
      const changePct = ((lastClose - prevClose) / prevClose) * 100

      const refHigh = Math.max(...candles.slice(Math.max(0, n-21), n-1).map(c => c.high))
      const refLow  = Math.min(...candles.slice(Math.max(0, n-21), n-1).map(c => c.low))
      const vols    = candles.slice(Math.max(0, n-21), n-1).map(c => c.volume)
      const avgVol  = vols.reduce((a,b)=>a+b,0)/vols.length
      const volRatio = candles[n-1].volume / avgVol

      const isBreakout  = lastClose > refHigh
      const isBreakdown = lastClose < refLow

      setResult({
        symbol: querySym, name: querySym.replace('.NS',''),
        signal: isBreakout ? 'BREAKOUT' : isBreakdown ? 'BREAKDOWN' : 'NEUTRAL',
        close: lastClose, changePct: +changePct.toFixed(2),
        volume: candles[n-1].volume, avgVolume: Math.round(avgVol),
        volumeRatio: +volRatio.toFixed(2),
        refHigh, refLow,
        currency: data.currency || 'INR',
      })
    } catch (e) {
      setError(e.message || 'Symbol not found')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 22px', marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Custom Symbol Lookup</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="RELIANCE, XAUUSD=X, EURUSD=X, BTC-USD …"
          style={{
            flex: 1, padding: '11px 16px', background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${C.border}`, borderRadius: 10,
            color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={e => e.target.style.borderColor = C.purple}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        <button
          onClick={search}
          disabled={loading}
          style={{
            padding: '11px 24px', background: C.purple, border: 'none',
            borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '…' : 'Scan'}
        </button>
      </div>

      {error && <div style={{ marginTop: 10, fontSize: 13, color: C.red }}>⚠ {error}</div>}

      {result && (
        <div style={{ marginTop: 14, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{result.name}</span>
              <span style={{ marginLeft: 10, fontSize: 13, color: result.changePct >= 0 ? C.green : C.red, fontWeight: 700 }}>
                {result.changePct >= 0 ? '+' : ''}{result.changePct}%
              </span>
              <span style={{ marginLeft: 10 }}>
                {result.signal !== 'NEUTRAL' ? <Badge signal={result.signal} /> :
                  <span style={{ fontSize: 11, color: C.muted, padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}` }}>No signal</span>
                }
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onViewChart(result.symbol)}
                style={{ padding: '7px 16px', background: 'rgba(82,39,255,0.2)', border: `1px solid rgba(82,39,255,0.3)`, borderRadius: 8, color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                📊 Chart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   MAIN SCANNER PAGE
───────────────────────────────────────────────────────────────── */
export default function Scanner() {
  const [data,          setData]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [chartSymbol,   setChartSymbol]   = useState(null)
  const [tab,           setTab]           = useState('breakouts') // 'breakouts' | 'breakdowns'
  const [lookback,      setLookback]      = useState(20)
  const [minVolRatio,   setMinVolRatio]   = useState(1.3)
  const [lastScanned,   setLastScanned]   = useState(null)

  const scan = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.scan(lookback, minVolRatio)
      setData(result)
      setLastScanned(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { scan() }, [])

  const displayed = data
    ? (tab === 'breakouts' ? data.breakouts : data.breakdowns)
    : []

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>Market Scanner</h1>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
            Breakout & breakdown detection across NIFTY 50 + Forex using 20-day high/low with volume confirmation
            {lastScanned && ` · Scanned ${lastScanned.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          onClick={scan}
          disabled={loading}
          style={{
            padding: '10px 22px', background: loading ? 'rgba(82,39,255,0.3)' : C.purple,
            border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {loading ? '⟳ Scanning…' : '⟳ Rescan'}
        </button>
      </div>

      {/* Params */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lookback</span>
          {[10, 20, 50].map(n => (
            <button key={n} onClick={() => setLookback(n)} style={{
              padding: '5px 12px', border: 'none', borderRadius: 8, fontFamily: 'inherit',
              background: lookback === n ? C.purple : 'rgba(255,255,255,0.06)',
              color: lookback === n ? '#fff' : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{n}D</button>
          ))}
        </div>
        <div style={{ width: 1, height: 24, background: C.border }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Min Vol</span>
          {[1.2, 1.3, 1.5, 2.0].map(v => (
            <button key={v} onClick={() => setMinVolRatio(v)} style={{
              padding: '5px 12px', border: 'none', borderRadius: 8, fontFamily: 'inherit',
              background: minVolRatio === v ? C.purple : 'rgba(255,255,255,0.06)',
              color: minVolRatio === v ? '#fff' : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{v}×</button>
          ))}
        </div>
      </div>

      {/* Custom search */}
      <SymbolSearch onViewChart={setChartSymbol} />

      {/* Stats row */}
      {data && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Scanned',    value: data.scannedCount, color: '#fff' },
            { label: 'Breakouts',  value: data.breakouts.length,  color: C.green },
            { label: 'Breakdowns', value: data.breakdowns.length, color: C.red },
            { label: 'Signal Rate', value: `${data.scannedCount > 0 ? ((data.total / data.scannedCount) * 100).toFixed(0) : 0}%`, color: '#C084FC' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, marginBottom: 20, width: 'fit-content' }}>
        {[
          { id: 'breakouts',  label: `▲ Breakouts ${data ? `(${data.breakouts.length})` : ''}`,  color: C.green },
          { id: 'breakdowns', label: `▼ Breakdowns ${data ? `(${data.breakdowns.length})` : ''}`, color: C.red },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '9px 20px', border: 'none', borderRadius: 9, fontFamily: 'inherit',
              background: tab === t.id ? (t.id === 'breakouts' ? 'rgba(52,199,123,0.15)' : 'rgba(255,92,92,0.15)') : 'transparent',
              color:      tab === t.id ? t.color : C.muted,
              fontWeight: tab === t.id ? 700 : 400, fontSize: 13, cursor: 'pointer',
              border: tab === t.id ? `1px solid ${t.id === 'breakouts' ? 'rgba(52,199,123,0.3)' : 'rgba(255,92,92,0.3)'}` : '1px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '14px 18px', background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.2)', borderRadius: 12, color: C.red, fontSize: 13, marginBottom: 16 }}>
          ⚠ {error} — Check your Worker is deployed and VITE_API_URL is set correctly.
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, height: 180, opacity: 0.4, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && data && (
        <>
          {displayed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted, fontSize: 14 }}>
              No {tab} detected today with the current filters.<br />
              <span style={{ fontSize: 12 }}>Try lowering the volume ratio threshold or changing the lookback period.</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {displayed.map(item => (
                <SignalCard key={item.symbol} data={item} onViewChart={setChartSymbol} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Candlestick Chart Modal */}
      {chartSymbol && (
        <CandleChart symbol={chartSymbol} onClose={() => setChartSymbol(null)} />
      )}
    </div>
  )
}
