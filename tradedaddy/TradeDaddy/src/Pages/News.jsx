/**
 * News.jsx — TradeDaddy
 * Live news from Google News RSS + AI analysis per article
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'

const C = { bg:'#09070f', s:'rgba(255,255,255,0.03)', b:'rgba(255,255,255,0.07)', p:'#5227FF', g:'#34C77B', r:'#FF5C5C', a:'#F59E0B', m:'rgba(255,255,255,0.4)' }

const CATEGORIES = [
  { id:'markets',     label:'🇮🇳 Markets',     desc:'NSE/BSE' },
  { id:'economy',     label:'🏦 Economy',       desc:'RBI, Macro' },
  { id:'global',      label:'🌏 Global',        desc:'Fed, US, World' },
  { id:'commodities', label:'🛢 Commodities',   desc:'Oil, Gold' },
  { id:'earnings',    label:'📊 Earnings',      desc:'Q Results' },
]

const IMPACT_COLORS = { HIGH:'#FF5C5C', MEDIUM:'#F59E0B', LOW:'#34C77B' }
const SENTIMENT_CFG = {
  BULLISH: { color:'#34C77B', bg:'rgba(52,199,123,0.12)', icon:'🟢' },
  BEARISH: { color:'#FF5C5C', bg:'rgba(255,92,92,0.12)',  icon:'🔴' },
  NEUTRAL: { color:'rgba(255,255,255,0.4)', bg:'rgba(255,255,255,0.05)', icon:'⚪' },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr), now = new Date()
    const diff = Math.floor((now - d) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
    return `${Math.floor(diff/86400)}d ago`
  } catch { return '' }
}

function ImpactBadge({ impact }) {
  const color = IMPACT_COLORS[impact] || C.m
  return (
    <span style={{ padding:'2px 8px', borderRadius:999, fontSize:10, fontWeight:800, letterSpacing:'0.07em', textTransform:'uppercase', background:`${color}18`, color, border:`1px solid ${color}40` }}>
      {impact === 'HIGH' ? '⚡ High' : impact === 'MEDIUM' ? '◎ Medium' : '○ Low'} Impact
    </span>
  )
}

function StockTag({ stock }) {
  const isUp = stock.direction === 'UP'
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', background: isUp?'rgba(52,199,123,0.1)':'rgba(255,92,92,0.1)', border:`1px solid ${isUp?'rgba(52,199,123,0.25)':'rgba(255,92,92,0.25)'}`, borderRadius:8, fontSize:12, marginRight:6, marginBottom:6 }}>
      <span style={{ fontWeight:700, color: isUp?C.g:C.r }}>{isUp?'▲':'▼'} {stock.symbol}</span>
      <span style={{ color:C.m }}>{stock.name}</span>
    </div>
  )
}

function NewsCard({ article, idx }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [expanded, setExpanded] = useState(false)

  const analyze = async (e) => {
    e.stopPropagation()
    if (analysis) { setExpanded(!expanded); return }
    setLoading(true)
    try {
      const result = await api.analyzeNews(article.title, article.description)
      setAnalysis(result)
      setExpanded(true)
    } catch(e) {
      setAnalysis({ sentiment:'NEUTRAL', impact:'LOW', affectedStocks:[], affectedSectors:[], summary:'Analysis unavailable. Check ANTHROPIC_API_KEY in worker secrets.', timeframe:'unknown' })
      setExpanded(true)
    } finally { setLoading(false) }
  }

  const sentCfg = analysis ? (SENTIMENT_CFG[analysis.sentiment] || SENTIMENT_CFG.NEUTRAL) : null

  return (
    <div style={{ background:C.s, border:`1px solid ${expanded?'rgba(82,39,255,0.3)':C.b}`, borderRadius:16, padding:'18px 20px', transition:'border-color 0.2s' }}>
      {/* Article header */}
      <div style={{ display:'flex', justifyContent:'space-between', gap:14, marginBottom:10 }}>
        <div style={{ flex:1 }}>
          {article.source && <div style={{ fontSize:11, color:C.m, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600 }}>{article.source}</div>}
          <a href={article.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none', color:'#fff', fontSize:14, fontWeight:600, lineHeight:1.5, display:'block' }}
            onMouseEnter={e=>e.target.style.color=C.p} onMouseLeave={e=>e.target.style.color='#fff'}>
            {article.title}
          </a>
          {article.description && <p style={{ margin:'6px 0 0', fontSize:12, color:C.m, lineHeight:1.55 }}>{article.description}</p>}
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', whiteSpace:'nowrap' }}>{timeAgo(article.pubDate)}</span>
          <button onClick={analyze} disabled={loading}
            style={{ padding:'6px 14px', background: analysis ? 'rgba(82,39,255,0.2)' : C.p, border:`1px solid ${analysis ? 'rgba(82,39,255,0.3)' : 'transparent'}`, borderRadius:9, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', opacity:loading?0.7:1 }}>
            {loading ? '🤖 Analysing…' : analysis ? (expanded ? '▲ Hide' : '▼ Show Analysis') : '🤖 Analyse'}
          </button>
        </div>
      </div>

      {/* AI Analysis panel */}
      {expanded && analysis && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.b}` }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <span style={{ padding:'4px 12px', borderRadius:999, fontSize:12, fontWeight:700, background:sentCfg.bg, color:sentCfg.color }}>
              {sentCfg.icon} {analysis.sentiment}
            </span>
            <ImpactBadge impact={analysis.impact} />
            {analysis.timeframe && (
              <span style={{ padding:'4px 10px', borderRadius:999, fontSize:11, background:'rgba(255,255,255,0.05)', color:C.m, border:`1px solid ${C.b}` }}>
                ⏱ {analysis.timeframe}
              </span>
            )}
          </div>

          <p style={{ margin:'0 0 12px', fontSize:13, color:'rgba(255,255,255,0.8)', lineHeight:1.65, padding:'10px 14px', background: sentCfg.bg, borderRadius:10, borderLeft:`3px solid ${sentCfg.color}` }}>
            {analysis.summary}
          </p>

          {analysis.affectedStocks?.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.m, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Stocks that may be affected</div>
              <div style={{ display:'flex', flexWrap:'wrap' }}>
                {analysis.affectedStocks.map((s,i) => <StockTag key={i} stock={s} />)}
              </div>
              {/* Reasons */}
              {analysis.affectedStocks.map((s,i) => s.reason && (
                <div key={i} style={{ fontSize:12, color:C.m, marginBottom:2 }}>
                  <span style={{ color: s.direction==='UP'?C.g:C.r, fontWeight:700 }}>{s.symbol}</span> — {s.reason}
                </div>
              ))}
            </div>
          )}

          {analysis.affectedSectors?.length > 0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.m, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Sectors</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {analysis.affectedSectors.map(s => (
                  <span key={s} style={{ padding:'3px 10px', background:'rgba(82,39,255,0.12)', border:'1px solid rgba(82,39,255,0.25)', borderRadius:6, fontSize:12, color:'rgba(255,255,255,0.7)' }}>{s}</span>
                ))}
              </div>
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
  const [fetchedAt,setFetchedAt]= useState(null)

  const load = useCallback(async (category = cat) => {
    setLoading(true); setError(null)
    try {
      const data = await api.getNews(category)
      setArticles(data.articles || [])
      setFetchedAt(new Date())
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }, [cat])

  useEffect(() => { load(cat) }, [cat])

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1 style={{ margin:'0 0 4px', fontSize:22, fontWeight:800 }}>News & Analysis</h1>
          <p style={{ margin:0, fontSize:13, color:C.m }}>
            {articles.length} articles · Click "🤖 Analyse" on any headline for AI stock impact analysis
            {fetchedAt && ` · ${fetchedAt.toLocaleTimeString()}`}
          </p>
        </div>
        <button onClick={()=>load(cat)} disabled={loading} style={{ padding:'9px 18px', background:loading?'rgba(82,39,255,0.4)':C.p, border:'none', borderRadius:12, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          ⟳ Refresh
        </button>
      </div>

      {/* Category tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:22, overflowX:'auto', paddingBottom:4 }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={()=>setCat(c.id)} style={{ padding:'9px 16px', border:'none', borderRadius:12, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0, transition:'all 0.2s', background:cat===c.id?C.p:C.s, color:cat===c.id?'#fff':C.m, fontWeight:cat===c.id?700:400, fontSize:13, border:cat===c.id?'none':`1px solid ${C.b}` }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* AI note */}
      <div style={{ padding:'10px 16px', background:'rgba(82,39,255,0.08)', border:'1px solid rgba(82,39,255,0.2)', borderRadius:12, fontSize:13, color:'rgba(255,255,255,0.65)', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
        🤖 <span><strong style={{ color:'#fff' }}>AI Analysis powered by Claude Haiku</strong> — Click "Analyse" on any article to see which stocks and sectors may be impacted. Requires ANTHROPIC_API_KEY in worker secrets.</span>
      </div>

      {error && <div style={{ padding:'12px 16px', background:'rgba(255,92,92,0.08)', border:'1px solid rgba(255,92,92,0.2)', borderRadius:12, color:C.r, fontSize:13, marginBottom:16 }}>⚠ {error}</div>}

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[...Array(5)].map((_,i) => <div key={i} style={{ height:80, background:C.s, borderRadius:14, opacity:0.4 }} />)}
        </div>
      ) : articles.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:C.m, fontSize:14 }}>No articles found. Try refreshing.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {articles.map((a,i) => <NewsCard key={i} article={a} idx={i} />)}
        </div>
      )}
    </div>
  )
}