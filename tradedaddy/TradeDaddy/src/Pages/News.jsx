import { useState, useEffect, useCallback } from 'react'
import { getNews, analyzeNews } from '../utils/api'

const C = { s:'rgba(255,255,255,0.03)', b:'rgba(255,255,255,0.07)', p:'#5227FF', g:'#34C77B', r:'#FF5C5C', a:'#F59E0B', m:'rgba(255,255,255,0.4)' }

const CATEGORIES = [
  { id:'markets',     label:'🇮🇳 Markets' },
  { id:'economy',     label:'🏦 Economy' },
  { id:'global',      label:'🌏 Global' },
  { id:'commodities', label:'🛢 Commodities' },
  { id:'earnings',    label:'📊 Earnings' },
]

const SENTIMENT_CFG = {
  BULLISH: { color:'#34C77B', bg:'rgba(52,199,123,0.12)', icon:'🟢' },
  BEARISH: { color:'#FF5C5C', bg:'rgba(255,92,92,0.12)',  icon:'🔴' },
  NEUTRAL: { color:'rgba(255,255,255,0.4)', bg:'rgba(255,255,255,0.05)', icon:'⚪' },
}

function ImpactBadge({ impact }) {
  const colors = { HIGH:'#FF5C5C', MEDIUM:'#F59E0B', LOW:'#34C77B' }
  const color = colors[impact] || C.m
  return <span style={{ padding:'2px 8px', borderRadius:999, fontSize:10, fontWeight:800, letterSpacing:'0.07em', textTransform:'uppercase', background:`${color}18`, color, border:`1px solid ${color}40` }}>{impact==='HIGH'?'⚡':impact==='MEDIUM'?'◎':'○'} {impact} Impact</span>
}

function NewsCard({ article }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [expanded, setExpanded] = useState(false)

  const analyze = async (e) => {
    e.stopPropagation()
    if (analysis) { setExpanded(v => !v); return }
    setLoading(true)
    try {
      const result = await analyzeNews(article.title, article.description)
      setAnalysis(result); setExpanded(true)
    } catch {
      setAnalysis({ sentiment:'NEUTRAL', impact:'LOW', affectedStocks:[], affectedSectors:[], summary:'Analysis unavailable — add ANTHROPIC_API_KEY to worker secrets.', timeframe:'unknown' })
      setExpanded(true)
    } finally { setLoading(false) }
  }

  const sentCfg = analysis ? (SENTIMENT_CFG[analysis.sentiment] || SENTIMENT_CFG.NEUTRAL) : null
  const timeAgo = (d) => { if(!d) return ''; try { const s=Math.floor((Date.now()-new Date(d))/1000); return s<3600?`${Math.floor(s/60)}m`:s<86400?`${Math.floor(s/3600)}h`:`${Math.floor(s/86400)}d` } catch{return ''} }

  return (
    <div style={{ background:C.s, border:`1px solid ${expanded?'rgba(82,39,255,0.3)':C.b}`, borderRadius:16, padding:'16px 18px', transition:'border-color 0.2s' }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:14 }}>
        <div style={{ flex:1 }}>
          {article.source && <div style={{ fontSize:10, color:C.m, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>{article.source}</div>}
          <a href={article.link} target="_blank" rel="noopener noreferrer"
            style={{ textDecoration:'none', color:'#fff', fontSize:14, fontWeight:600, lineHeight:1.5, display:'block' }}
            onMouseEnter={e=>e.target.style.color='#5227FF'} onMouseLeave={e=>e.target.style.color='#fff'}>
            {article.title}
          </a>
          {article.description && <p style={{ margin:'5px 0 0', fontSize:12, color:C.m, lineHeight:1.55 }}>{article.description}</p>}
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.25)' }}>{timeAgo(article.pubDate)}</span>
          <button onClick={analyze} disabled={loading}
            style={{ padding:'5px 12px', background:analysis?'rgba(82,39,255,0.15)':C.p, border:`1px solid ${analysis?'rgba(82,39,255,0.3)':'transparent'}`, borderRadius:8, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:loading?0.7:1, whiteSpace:'nowrap' }}>
            {loading?'🤖 Analysing…':analysis?(expanded?'▲ Hide':'▼ Analysis'):'🤖 Analyse'}
          </button>
        </div>
      </div>
      {expanded && analysis && (
        <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.b}` }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
            <span style={{ padding:'3px 10px', borderRadius:999, fontSize:12, fontWeight:700, background:sentCfg.bg, color:sentCfg.color }}>{sentCfg.icon} {analysis.sentiment}</span>
            <ImpactBadge impact={analysis.impact} />
            {analysis.timeframe && <span style={{ padding:'3px 10px', borderRadius:999, fontSize:11, background:'rgba(255,255,255,0.05)', color:C.m, border:`1px solid ${C.b}` }}>⏱ {analysis.timeframe}</span>}
          </div>
          <p style={{ margin:'0 0 10px', fontSize:13, color:'rgba(255,255,255,0.8)', lineHeight:1.65, padding:'10px 12px', background:sentCfg.bg, borderRadius:10, borderLeft:`3px solid ${sentCfg.color}` }}>{analysis.summary}</p>
          {analysis.affectedStocks?.length > 0 && (
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.m, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Affected Stocks</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {analysis.affectedStocks.map((s,i) => (
                  <span key={i} style={{ padding:'3px 10px', borderRadius:8, fontSize:12, fontWeight:700, background:s.direction==='UP'?'rgba(52,199,123,0.1)':'rgba(255,92,92,0.1)', color:s.direction==='UP'?C.g:C.r, border:`1px solid ${s.direction==='UP'?'rgba(52,199,123,0.25)':'rgba(255,92,92,0.25)'}` }}>
                    {s.direction==='UP'?'▲':'▼'} {s.symbol} <span style={{ fontWeight:400, color:C.m }}>— {s.reason}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {analysis.affectedSectors?.length > 0 && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {analysis.affectedSectors.map(s => <span key={s} style={{ padding:'2px 10px', background:'rgba(82,39,255,0.12)', border:'1px solid rgba(82,39,255,0.25)', borderRadius:6, fontSize:12, color:'rgba(255,255,255,0.7)' }}>{s}</span>)}
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

  const load = useCallback(async (category) => {
    setLoading(true); setError(null)
    try {
      const data = await getNews(category)
      setArticles(data.articles || []); setTs(new Date())
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(cat) }, [cat])

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
        <div>
          <h1 style={{ margin:'0 0 4px', fontSize:22, fontWeight:800 }}>News & Analysis</h1>
          <p style={{ margin:0, fontSize:13, color:C.m }}>{articles.length} articles{ts && ` · ${ts.toLocaleTimeString()}`}</p>
        </div>
        <button onClick={()=>load(cat)} disabled={loading} style={{ padding:'9px 18px', background:loading?'rgba(82,39,255,0.4)':'#5227FF', border:'none', borderRadius:12, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>⟳ Refresh</button>
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:18, overflowX:'auto', paddingBottom:4 }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={()=>setCat(c.id)} style={{ padding:'8px 16px', border:'none', borderRadius:11, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0, background:cat===c.id?'#5227FF':'rgba(255,255,255,0.04)', color:cat===c.id?'#fff':C.m, fontWeight:cat===c.id?700:400, fontSize:13, border:cat===c.id?'none':`1px solid ${C.b}` }}>{c.label}</button>
        ))}
      </div>
      <div style={{ padding:'10px 14px', background:'rgba(82,39,255,0.08)', border:'1px solid rgba(82,39,255,0.2)', borderRadius:12, fontSize:13, color:'rgba(255,255,255,0.65)', marginBottom:18 }}>
        🤖 Click <strong style={{ color:'#fff' }}>Analyse</strong> on any article for AI-powered stock impact analysis. Requires ANTHROPIC_API_KEY in worker secrets.
      </div>
      {error && <div style={{ padding:'12px 14px', background:'rgba(255,92,92,0.08)', border:'1px solid rgba(255,92,92,0.2)', borderRadius:12, color:'#FF5C5C', fontSize:13, marginBottom:14 }}>⚠ {error}</div>}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[...Array(5)].map((_,i) => <div key={i} style={{ height:80, background:C.s, borderRadius:14, opacity:0.4 }} />)}
        </div>
      ) : articles.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:C.m }}>No articles found. Try refreshing.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {articles.map((a,i) => <NewsCard key={i} article={a} />)}
        </div>
      )}
    </div>
  )
}