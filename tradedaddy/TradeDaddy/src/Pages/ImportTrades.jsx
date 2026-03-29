/**
 * ImportTrades.jsx — TradeDaddy
 * Works with ANY MT5 broker and Dhan — no API/server issues
 * Supports: MT5 HTML Report, MT5 CSV, Dhan CSV
 *
 * How to export from MT5:
 *   Terminal → Account History tab → right-click → Save as Report (HTML or CSV)
 * How to export from Dhan:
 *   Reports → Trade Book → Download CSV
 */
import { useState, useRef, useCallback } from 'react'
import { createTrade } from '../utils/api'

const T = {
  bg:'#07050e', card:'rgba(255,255,255,0.025)', border:'rgba(255,255,255,0.08)',
  borderHi:'rgba(255,255,255,0.14)',
  p:'#5B2EFF', g:'#2ECC8A', r:'#FF4D6A', a:'#F5A623',
  t:'rgba(255,255,255,0.92)', m:'rgba(255,255,255,0.52)',
  d:'rgba(255,255,255,0.32)', f:'rgba(255,255,255,0.06)',
  font:'"DM Sans","Space Grotesk",sans-serif',
  mono:'"JetBrains Mono","Fira Code",monospace',
}

/* ── Parse MT5 HTML Report ── */
function parseMt5Html(html) {
  const parser = new DOMParser()
  const doc    = parser.parseFromString(html, 'text/html')
  const rows   = Array.from(doc.querySelectorAll('tr')).filter(r => r.cells.length >= 8)
  const deals  = []

  rows.forEach(row => {
    const cells = Array.from(row.cells).map(c => c.textContent.trim())
    // MT5 HTML report row: Time | Deal | Symbol | Type | Direction | Volume | Price | Order | Commission | Swap | Profit | Balance | Comment
    const [time, deal, symbol, type, direction, volume, price, order, commission, swap, profit] = cells
    if (!symbol || symbol === 'Symbol' || !price || price === 'Price') return
    if (!type || !('buy' + 'sell' + 'balance' + 'credit').includes(type.toLowerCase())) return
    if (type.toLowerCase() === 'balance' || type.toLowerCase() === 'credit') return
    deals.push({ time, deal, symbol: symbol.trim(), type: type.toLowerCase(), direction: direction?.toLowerCase(), volume: parseFloat(volume) || 0, price: parseFloat(price) || 0, profit: parseFloat(profit?.replace(' ','')) || 0, commission: parseFloat(commission) || 0 })
  })
  return matchDeals(deals)
}

/* ── Parse MT5 CSV ── */
function parseMt5Csv(csv) {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean)
  const deals = []

  for (const line of lines) {
    // Handle quoted CSV
    const cells = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    cells.push(cur.trim())

    const [time, deal, symbol, type, direction, volume, price, order, commission, swap, profit] = cells
    if (!symbol || symbol === 'Symbol' || symbol === '#') continue
    if (!type || !('buy' + 'sell').includes(type.toLowerCase())) continue

    deals.push({
      time, deal, symbol: symbol.trim(), type: type.toLowerCase(),
      direction: direction?.toLowerCase(),
      volume: parseFloat(volume) || 0,
      price:  parseFloat(price)  || 0,
      profit: parseFloat(profit?.replace(' ','')) || 0,
      commission: parseFloat(commission) || 0,
    })
  }
  return matchDeals(deals)
}

/* ── Match IN/OUT deals into complete trades ── */
function matchDeals(deals) {
  const trades  = []
  const openMap = {}  // symbol -> { deal, price, volume, time, type }

  for (const d of deals) {
    const sym = d.symbol
    const isIn  = d.direction === 'in'  || (d.type === 'buy'  && !d.direction)
    const isOut = d.direction === 'out' || (d.type === 'sell' && !d.direction)

    if (isIn) {
      openMap[sym] = d
    } else if (isOut && openMap[sym]) {
      const open = openMap[sym]
      const pnl  = d.profit || ((d.price - open.price) * open.volume * (open.type === 'buy' ? 1 : -1))
      trades.push({
        symbol:     sym,
        type:       open.type === 'buy' ? 'LONG' : 'SHORT',
        entry:      open.price,
        exit:       d.price,
        qty:        open.volume,
        pnl:        +pnl.toFixed(2),
        date:       parseDate(open.time || d.time),
        setup:      'MT5 Import',
        notes:      `Imported from MT5. Commission: ${d.commission || 0}`,
        emotion:    '😐',
        discipline: 70,
      })
      delete openMap[sym]
    } else {
      // No matching open — treat as standalone closed trade if has profit
      if (d.profit !== 0 && sym) {
        trades.push({
          symbol:     sym,
          type:       d.type === 'buy' ? 'LONG' : 'SHORT',
          entry:      d.price,
          exit:       d.price,
          qty:        d.volume,
          pnl:        +d.profit.toFixed(2),
          date:       parseDate(d.time),
          setup:      'MT5 Import',
          notes:      'Imported from MT5 (single leg)',
          emotion:    '😐',
          discipline: 70,
        })
      }
    }
  }
  return trades
}

/* ── Parse Dhan CSV ── */
function parseDhanCsv(csv) {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []

  // Find header row
  const headerIdx = lines.findIndex(l => l.toLowerCase().includes('trade date') || l.toLowerCase().includes('symbol'))
  if (headerIdx < 0) return []
  const headers = lines[headerIdx].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g,''))

  const col = (row, names) => {
    for (const n of names) {
      const i = headers.indexOf(n)
      if (i >= 0 && row[i]) return row[i].trim().replace(/"/g,'')
    }
    return ''
  }

  const buys = [], sells = []
  for (const line of lines.slice(headerIdx + 1)) {
    if (!line || line.startsWith('#')) continue
    const cells = line.split(',').map(c => c.trim().replace(/"/g,''))
    const tradeType = col(cells, ['tradetype','type','buysell','ordertype']).toLowerCase()
    const symbol    = col(cells, ['symbol','tradingsymbol','instrument'])
    const qty       = parseFloat(col(cells, ['qty','quantity','tradequantity'])) || 0
    const price     = parseFloat(col(cells, ['price','tradeprice','executedprice'])) || 0
    const date      = col(cells, ['tradedate','date','executiondate'])
    if (!symbol || !qty || !price) continue

    const trade = { symbol, qty, price, date: parseDate(date) }
    if (tradeType.includes('buy')) buys.push(trade)
    else if (tradeType.includes('sell')) sells.push(trade)
  }

  // Match buys and sells by symbol
  const trades = []
  const buyMap = {}
  buys.forEach(b => { if (!buyMap[b.symbol]) buyMap[b.symbol] = []; buyMap[b.symbol].push(b) })

  sells.forEach(s => {
    const matching = buyMap[s.symbol]
    if (matching?.length) {
      const b = matching.shift()
      const pnl = (s.price - b.price) * Math.min(b.qty, s.qty)
      trades.push({ symbol:s.symbol, type:'LONG', entry:b.price, exit:s.price, qty:Math.min(b.qty,s.qty), pnl:+pnl.toFixed(2), date:b.date||s.date, setup:'Dhan Import', notes:'Imported from Dhan CSV', emotion:'😐', discipline:70 })
    } else {
      trades.push({ symbol:s.symbol, type:'SHORT', entry:s.price, exit:s.price, qty:s.qty, pnl:0, date:s.date, setup:'Dhan Import', notes:'Imported from Dhan (sell-only leg)', emotion:'😐', discipline:70 })
    }
  })
  return trades
}

function parseDate(raw) {
  if (!raw) return new Date().toISOString().slice(0,10)
  try {
    // MT5 format: "2024.01.15 09:30:00" or "2024-01-15 09:30:00"
    const clean = raw.replace(/\./g, '-').replace(/\s+/g, 'T').split('T')[0]
    const d = new Date(clean)
    if (!isNaN(d)) return d.toISOString().slice(0,10)
  } catch {}
  return new Date().toISOString().slice(0,10)
}

function detectFormat(text) {
  if (text.includes('<html') || text.includes('<table') || text.includes('<tr')) return 'mt5-html'
  const lower = text.toLowerCase()
  if (lower.includes('trade date') || lower.includes('tradingsymbol') || lower.includes('dhan')) return 'dhan-csv'
  if (lower.includes('deal') || lower.includes('direction') || lower.includes('commission')) return 'mt5-csv'
  // Try to detect by first data line
  const lines = text.split('\n').filter(Boolean)
  if (lines.length > 1 && lines[1].split(',').length >= 8) return 'mt5-csv'
  return 'unknown'
}

/* ── Trade Preview Table ── */
function PreviewTable({ trades }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, overflow:'auto', maxHeight:320 }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, background:'#0d0b16' }}>
            {['Symbol','Type','Entry','Exit','Qty','P&L','Date'].map(h => (
              <th key={h} style={{ padding:'8px 12px', textAlign:h==='Symbol'?'left':'right', fontSize:10, fontWeight:700, color:T.d, textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.slice(0,100).map((t,i) => (
            <tr key={i} style={{ borderBottom:`1px solid ${T.f}` }}>
              <td style={{ padding:'7px 12px', fontWeight:700 }}>{t.symbol}</td>
              <td style={{ padding:'7px 12px', textAlign:'right' }}>
                <span style={{ padding:'1px 6px', borderRadius:4, fontSize:10, fontWeight:700, background: t.type === 'LONG'
  ? 'rgba(46,204,138,0.12)'
  : 'rgba(255,77,106,0.12)', color:t.type==='LONG'?T.g:T.r }}>{t.type}</span>
              </td>
              <td style={{ padding:'7px 12px', textAlign:'right', fontFamily:T.mono }}>{t.entry?.toFixed(4)}</td>
              <td style={{ padding:'7px 12px', textAlign:'right', fontFamily:T.mono }}>{t.exit?.toFixed(4)}</td>
              <td style={{ padding:'7px 12px', textAlign:'right', fontFamily:T.mono }}>{t.qty}</td>
              <td style={{ padding:'7px 12px', textAlign:'right', fontWeight:700, fontFamily:T.mono, color:t.pnl>=0?T.g:T.r }}>{t.pnl>=0?'+':''}{t.pnl?.toFixed(2)}</td>
              <td style={{ padding:'7px 12px', textAlign:'right', color:T.m }}>{t.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {trades.length > 100 && <div style={{ padding:'8px 12px', fontSize:11, color:T.d, textAlign:'center' }}>Showing first 100 of {trades.length} trades</div>}
    </div>
  )
}

/* ── Main Component ── */
export default function ImportTrades({ onImportDone }) {
  const [file,       setFile]       = useState(null)
  const [format,     setFormat]     = useState(null)
  const [trades,     setTrades]     = useState([])
  const [importing,  setImporting]  = useState(false)
  const [progress,   setProgress]   = useState(0)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState(null)
  const [dragOver,   setDragOver]   = useState(false)
  const fileRef = useRef()

  const processFile = useCallback(async (f) => {
    setFile(f); setTrades([]); setFormat(null); setDone(false); setError(null)
    try {
      const text = await f.text()
      const fmt  = detectFormat(text)
      setFormat(fmt)

      let parsed = []
      if (fmt === 'mt5-html') parsed = parseMt5Html(text)
      else if (fmt === 'mt5-csv') parsed = parseMt5Csv(text)
      else if (fmt === 'dhan-csv') parsed = parseDhanCsv(text)
      else { setError('Could not detect file format. Supported: MT5 HTML report, MT5 CSV, Dhan CSV.'); return }

      if (!parsed.length) { setError('No trades found in file. Make sure you exported Account History (not open positions).'); return }
      setTrades(parsed)
    } catch(e) { setError(`Parse error: ${e.message}`) }
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [processFile])

  const importAll = async () => {
    setImporting(true); setProgress(0)
    let ok = 0
    for (let i = 0; i < trades.length; i++) {
      try {
        await createTrade(trades[i])
        ok++
      } catch {}
      setProgress(Math.round(((i+1)/trades.length)*100))
    }
    setImporting(false); setDone(true)
    if (ok > 0) setTimeout(() => onImportDone?.(), 1500)
  }

  const FORMAT_LABELS = {
    'mt5-html': '✅ MT5 HTML Report',
    'mt5-csv':  '✅ MT5 CSV Export',
    'dhan-csv': '✅ Dhan Trade Book CSV',
    'unknown':  '⚠ Unknown format',
  }

  return (
    <div style={{ fontFamily:T.font }}>
      <h1 style={{ margin:'0 0 6px', fontSize:22, fontWeight:800, letterSpacing:'-0.02em' }}>Import Trades</h1>
      <p style={{ margin:'0 0 24px', fontSize:13, color:T.m }}>
        Works with <strong style={{ color:'#fff' }}>any broker</strong> — export from MT5 or Dhan, drag & drop here.
      </p>

      {/* How to export instructions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:24 }}>
        {[
          {
            icon:'📈', title:'From MetaTrader 5 (any broker)',
            steps:[
              'Open MT5 → View → Terminal (Ctrl+T)',
              'Click the "Account History" tab',
              'Right-click anywhere in the table',
              'Select "Save as Report" → HTML or CSV',
              'Upload the file below',
            ],
            color:'#5B2EFF'
          },
          {
            icon:'🏦', title:'From Dhan',
            steps:[
              'Log into Dhan web/app',
              'Go to Reports → Trade Book',
              'Set date range',
              'Click "Download" → CSV',
              'Upload the file below',
            ],
            color:'#F5A623'
          },
        ].map(s => (
          <div key={s.title} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'16px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:12 }}>
              <span style={{ fontSize:20 }}>{s.icon}</span>
              <div style={{ fontSize:13, fontWeight:700 }}>{s.title}</div>
            </div>
            <ol style={{ margin:0, padding:'0 0 0 16px', display:'flex', flexDirection:'column', gap:5 }}>
              {s.steps.map((step,i) => (
                <li key={i} style={{ fontSize:12, color:T.m, lineHeight:1.55 }}>{step}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e=>{e.preventDefault();setDragOver(true)}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={onDrop}
        onClick={()=>fileRef.current?.click()}
        style={{ border:`2px dashed ${dragOver?T.p:T.border}`, borderRadius:16, padding:'40px 24px', textAlign:'center', cursor:'pointer', background:dragOver?'rgba(91,46,255,0.07)':T.card, transition:'all 0.2s' }}>
        <input ref={fileRef} type="file" accept=".html,.htm,.csv,.txt" style={{ display:'none' }} onChange={e=>e.target.files[0]&&processFile(e.target.files[0])}/>
        <div style={{ fontSize:36, marginBottom:12 }}>{dragOver?'⬇':'📂'}</div>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>
          {file ? file.name : 'Drop your export file here'}
        </div>
        <div style={{ fontSize:12, color:T.d }}>
          {file ? 'Click to choose a different file' : 'Accepts MT5 HTML report, MT5 CSV, Dhan CSV · Click or drag & drop'}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginTop:14, padding:'11px 14px', background:'rgba(255,77,106,0.08)', border:'1px solid rgba(255,77,106,0.22)', borderRadius:11, fontSize:13, color:T.r }}>{error}</div>
      )}

      {/* Format detected + preview */}
      {format && trades.length > 0 && (
        <div style={{ marginTop:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div>
              <span style={{ fontSize:13, fontWeight:700, color:T.g }}>{FORMAT_LABELS[format]}</span>
              <span style={{ marginLeft:12, fontSize:13, color:T.m }}>{trades.length} trades parsed</span>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <span style={{ fontSize:12, color:T.d }}>
                Total P&L: <strong style={{ color:trades.reduce((s,t)=>s+t.pnl,0)>=0?T.g:T.r }}>
                  {trades.reduce((s,t)=>s+t.pnl,0)>=0?'+':''}{trades.reduce((s,t)=>s+t.pnl,0).toFixed(2)}
                </strong>
              </span>
            </div>
          </div>

          <PreviewTable trades={trades}/>

          {/* Import button */}
          {!done ? (
            <button onClick={importAll} disabled={importing}
              style={{ marginTop:14, width:'100%', padding:'13px 0', background:importing?'rgba(91,46,255,0.4)':T.p, border:'none', borderRadius:12, color:'#fff', fontSize:15, fontWeight:700, cursor:importing?'not-allowed':'pointer', fontFamily:T.font, boxShadow:importing?'none':'0 2px 14px rgba(91,46,255,0.35)' }}>
              {importing
                ? <span>Importing… {progress}% ({Math.round(trades.length*progress/100)}/{trades.length})</span>
                : `Import ${trades.length} trades into Journal`}
            </button>
          ) : (
            <div style={{ marginTop:14, padding:'13px 0', background:'rgba(46,204,138,0.08)', border:'1px solid rgba(46,204,138,0.25)', borderRadius:12, textAlign:'center', fontSize:15, fontWeight:700, color:T.g }}>
              ✅ {trades.length} trades imported successfully!
            </div>
          )}

          {importing && (
            <div style={{ marginTop:8, height:4, background:T.f, borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${progress}%`, background:T.p, borderRadius:2, transition:'width 0.3s' }}/>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop:24, padding:'12px 14px', background:T.card, border:`1px solid ${T.border}`, borderRadius:12, fontSize:11, color:T.d, lineHeight:1.7 }}>
        🔒 Your trade data is processed in the browser and stored in your private Cloudflare D1 database.
        Supported formats: MT5 HTML Report, MT5 CSV Export, Dhan Trade Book CSV. Works with <strong style={{ color:'rgba(255,255,255,0.5)' }}>any MT5 broker</strong> — no API key or server connection needed.
      </div>
    </div>
  )
}