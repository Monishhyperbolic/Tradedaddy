import { useState, useEffect, useCallback } from 'react'
import { getNews, analyzeNews, getQuote } from '../utils/api'

const T = {
  bg:'#07050e', card:'rgba(255,255,255,0.025)', border:'rgba(255,255,255,0.08)',
  p:'#5B2EFF', g:'#2ECC8A', r:'#FF4D6A', a:'#F5A623', b:'#3B9EFF',
  t:'rgba(255,255,255,0.92)', m:'rgba(255,255,255,0.5)', d:'rgba(255,255,255,0.3)',
  f:'rgba(255,255,255,0.07)',
}

const CATS = [
  { id:'markets',     icon:'🇮🇳', label:'Markets',     q:'NSE BSE Nifty' },
  { id:'economy',     icon:'🏦', label:'Economy',      q:'RBI India inflation' },
  { id:'global',      icon:'🌏', label:'Global',       q:'Fed US markets' },
  { id:'commodities', icon:'🛢', label:'Commodities',  q:'gold crude oil' },
  { id:'earnings',    icon:'📊', label:'Earnings',     q:'India quarterly results' },
]

const SENT = {
  BULLISH:{ color:'#2ECC8A', bg:'rgba(46,204,138,0.1)', icon:'▲', dot:'🟢' },
  BEARISH:{ color:'#FF4D6A', bg:'rgba(255,77,106,0.1)',  icon:'▼', dot:'🔴' },
  NEUTRAL:{ color:'rgba(255,255,255,0.4)', bg:'rgba(255,255,255,0.05)', icon:'◆', dot:'⚪' },
}

function timeAgo(d) {
  if (!d) return ''
  try {
    const s = Math.floor((Date.now() - new Date(d)) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s/60)}m ago`
    if (s < 86400) return `${Math.floor(s/3600)}h ago`
    return `${Math.floor(s/86400)}d ago`
  } catch { return '' }
}

function ImpactPill({ impact }) {
  const cfg = { HIGH:{c:'#FF4D6A',bg:'rgba(255,77,106,0.12)',label:'⚡ High'}, MEDIUM:{c:'#F5A623',bg:'rgba(245,166,35,0.12)',label:'◎ Medium'}, LOW:{c:'rgba(255,255,255,0.35)',bg:'rgba(255,255,255,0.06)',label:'○ Low'} }
  const s = cfg[impact]||cfg.LOW
  return <span style={{ padding:'2px 9px', borderRadius:999, fontSize:10, fontWeight:700, letterSpacing:'0.06em', background:s.bg, color:s.c, border:`1px solid ${s.c}30` }}>{s.label}</span>
}

function StockChip({ stock }) {
  const up = stock.direction==='UP'
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', background:up?'rgba(46,204,138,0.08)':'rgba(255,77,106,0.08)', border:`1px solid ${up?'rgba(46,204,138,0.2)':'rgba(255,77,106,0.2)'}`, borderRadius:8, fontSize:12, marginRight:6, marginTop:5 }}>
      <span style={{ color:up?T.g:T.r, fontWeight:700 }}>{up?'▲':'▼'} {stock.symbol}</span>
      {stock.name && <span style={{ color:T.m }}>·</span>}
      {stock.name && <span style={{ color:T.m, fontSize:11 }}>{stock.name}</span>}
    </span>
  )
}

function ArticleCard({ article }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const sc = analysis ? (SENT[analysis.sentiment]||SENT.NEUTRAL) : null

  const analyze = async () => {
    if (analysis) { setOpen(v=>!v); return }
    setLoading(true)
    try {
      const r = await analyzeNews(article.title, article.description)
      setAnalysis(r); setOpen(true)
    } catch {
      setAnalysis({ sentiment:'NEUTRAL', impact:'LOW', affectedStocks:[], affectedSectors:[], summary:'Analysis unavailable. Check GROQ_API_KEY in worker secrets.', timeframe:'unknown' })
      setOpen(true)
    } finally { setLoading(false) }
  }

  return (
    <div style={{ background:T.card, border:`1px solid ${open?T.p+'44':T.border}`, borderRadius:16, overflow:'hidden', transition:'border-color 0.2s' }}>
      <div style={{ padding:'16px 18px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:14, alignItems:'flex-start' }}>
          <div style={{ flex:1, minWidth:0 }}>
            {article.source && (
              <div style={{ fontSize:10, color:T.d, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:T.p, display:'inline-block' }}/>
                {article.source}
              </div>
            )}
            <a href={article.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none', color:T.t, fontSize:14, fontWeight:600, lineHeight:1.55, display:'block', transition:'color 0.15s' }}
              onMouseEnter={e=>e.target.style.color=T.p} onMouseLeave={e=>e.target.style.color=T.t}>
              {article.title}
            </a>
            {article.description && (
              <p style={{ margin:'6px 0 0', fontSize:12, color:T.m, lineHeight:1.6 }}>{article.description}</p>
            )}
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
            <span style={{ fontSize:11, color:T.d, whiteSpace:'nowrap' }}>{timeAgo(article.pubDate)}</span>
            <button onClick={analyze} disabled={loading} style={{
              padding:'6px 14px', borderRadius:9, border:'none', cursor:'pointer', fontFamily:'inherit',
              background: analysis ? 'rgba(91,46,255,0.15)' : T.p,
              border: analysis ? '1px solid rgba(91,46,255,0.35)' : '1px solid transparent',
              color:'#fff', fontSize:11, fontWeight:700, whiteSpace:'nowrap',
              opacity:loading?0.7:1, transition:'all 0.2s',
            }}>
              {loading ? '⟳ Analysing…' : analysis ? (open ? '▲ Hide' : '▼ Analysis') : '🤖 Analyse'}
            </button>
          </div>
        </div>
      </div>

      {open && analysis && (
        <div style={{ borderTop:`1px solid ${T.f}`, padding:'14px 18px', background:'rgba(91,46,255,0.03)' }}>
          {/* Sentiment + tags row */}
          <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:11 }}>
            <span style={{ padding:'3px 11px', borderRadius:999, fontSize:12, fontWeight:700, background:sc.bg, color:sc.color }}>
              {sc.dot} {analysis.sentiment}
            </span>
            <ImpactPill impact={analysis.impact} />
            {analysis.timeframe && <span style={{ padding:'3px 10px', borderRadius:999, fontSize:11, background:T.f, color:T.m, border:`1px solid ${T.border}` }}>⏱ {analysis.timeframe}</span>}
          </div>

          {/* Summary */}
          <div style={{ padding:'10px 14px', background:sc.bg, borderRadius:10, borderLeft:`3px solid ${sc.color}`, marginBottom:11, fontSize:13, color:T.t, lineHeight:1.7 }}>
            {analysis.summary}
          </div>

          {/* Affected stocks */}
          {analysis.affectedStocks?.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.d, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>Stocks that may move</div>
              <div>{analysis.affectedStocks.map((s,i) => <StockChip key={i} stock={s} />)}</div>
              <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:3 }}>
                {analysis.affectedStocks.map((s,i) => s.reason && (
                  <div key={i} style={{ fontSize:12, color:T.m }}>
                    <span style={{ color:s.direction==='UP'?T.g:T.r, fontWeight:700 }}>{s.symbol}</span> — {s.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sectors */}
          {analysis.affectedSectors?.length > 0 && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {analysis.affectedSectors.map(s=>(
                <span key={s} style={{ padding:'2px 9px', background:'rgba(91,46,255,0.1)', border:'1px solid rgba(91,46,255,0.2)', borderRadius:6, fontSize:11, color:'rgba(255,255,255,0.65)' }}>{s}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function News() {
  const [cat,      setCat]      = useState('markets')
  const [articles, setArticles] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [ts,       setTs]       = useState(null)
  const [layout,   setLayout]   = useState('list') // list | grid

  const load = useCallback(async (c) => {
    setLoading(true); setError(null)
    try {
      const d = await getNews(c)
      setArticles(d.articles||[]); setTs(new Date())
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(cat) }, [cat])

  const currentCat = CATS.find(c=>c.id===cat)

  return (
    <div style={{ fontFamily:"'DM Sans','Space Grotesk',sans-serif" }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
        <div>
          <h1 style={{ margin:'0 0 4px', fontSize:22, fontWeight:800, letterSpacing:'-0.02em' }}>Market News</h1>
          <p style={{ margin:0, fontSize:13, color:T.m }}>
            {articles.length} articles · Click <strong style={{ color:'rgba(255,255,255,0.7)' }}>Analyse</strong> for AI stock impact
            {ts && <span style={{ color:T.d }}> · {ts.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setLayout(l=>l==='list'?'grid':'list')} style={{ padding:'8px 14px', background:T.card, border:`1px solid ${T.border}`, borderRadius:9, color:T.m, cursor:'pointer', fontFamily:'inherit', fontSize:12 }}>
            {layout==='list'?'⊞ Grid':'☰ List'}
          </button>
          <button onClick={()=>load(cat)} disabled={loading} style={{ padding:'8px 16px', background:loading?'rgba(91,46,255,0.4)':T.p, border:'none', borderRadius:9, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            ⟳ Refresh
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:20, overflowX:'auto', paddingBottom:2 }}>
        {CATS.map(c=>(
          <button key={c.id} onClick={()=>setCat(c.id)} style={{
            padding:'9px 16px', border:'none', borderRadius:11, cursor:'pointer', fontFamily:'inherit',
            whiteSpace:'nowrap', flexShrink:0, transition:'all 0.18s',
            background: cat===c.id ? T.p : T.card,
            color: cat===c.id ? '#fff' : T.m,
            fontWeight: cat===c.id ? 700 : 400, fontSize:13,
            boxShadow: cat===c.id ? '0 2px 12px rgba(91,46,255,0.35)' : 'none',
            border: cat===c.id ? 'none' : `1px solid ${T.border}`,
          }}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Info bar */}
      <div style={{ padding:'10px 14px', background:'rgba(91,46,255,0.07)', border:'1px solid rgba(91,46,255,0.18)', borderRadius:11, fontSize:12, color:T.m, marginBottom:18, display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:16 }}>🤖</span>
        <span>AI analysis powered by <strong style={{ color:'rgba(255,255,255,0.75)' }}>Groq Llama 3.3 70B</strong> — instant, grounded analysis of each headline. Requires <code style={{ background:'rgba(255,255,255,0.08)', padding:'1px 5px', borderRadius:4, fontSize:11 }}>GROQ_API_KEY</code> in worker secrets.</span>
      </div>

      {error && (
        <div style={{ padding:'12px 14px', background:'rgba(255,77,106,0.08)', border:'1px solid rgba(255,77,106,0.2)', borderRadius:11, color:T.r, fontSize:13, marginBottom:16 }}>
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[...Array(5)].map((_,i)=>(
            <div key={i} style={{ height:90, background:T.card, borderRadius:14, opacity:0.4, animation:'pulse 1.5s ease-in-out infinite', animationDelay:`${i*0.1}s` }}/>
          ))}
        </div>
      ) : articles.length===0 ? (
        <div style={{ textAlign:'center', padding:'80px 0', color:T.m }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📰</div>
          <div style={{ fontSize:15 }}>No articles found</div>
          <div style={{ fontSize:12, color:T.d, marginTop:4 }}>Try refreshing or switch categories</div>
        </div>
      ) : (
        <div style={{ display: layout==='grid' ? 'grid' : 'flex', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', flexDirection:'column', gap:10 }}>
          {articles.map((a,i) => <ArticleCard key={i} article={a} />)}
        </div>
      )}
    </div>
  )
}
