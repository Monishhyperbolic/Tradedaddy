import { useState, useEffect, useCallback } from 'react'

// ─── Replace these with your actual backend API calls ───
async function getNews(category) {
  throw new Error('getNews not configured — connect your backend API')
}
async function analyzeNews(title, description) {
  throw new Error('analyzeNews not configured — connect your backend API')
}

// ─── Styles ───
const fonts = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');`

const C = {
  bg: '#111114', fg: '#f2f2f2', card: 'rgba(255,255,255,0.04)', cardHover: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)', borderHover: 'rgba(255,255,255,0.14)',
  p: '#5227FF', pFg: '#fff', pBg: 'rgba(82,39,255,0.12)', pHover: 'rgba(82,39,255,0.22)',
  g: '#34C77B', gBg: 'rgba(52,199,123,0.12)',
  r: '#FF5C5C', rBg: 'rgba(255,92,92,0.12)',
  a: '#F59E0B', aBg: 'rgba(245,158,11,0.12)',
  muted: 'rgba(255,255,255,0.45)', mutedBg: 'rgba(255,255,255,0.05)',
  secondary: 'rgba(255,255,255,0.07)', secondaryFg: 'rgba(255,255,255,0.75)',
  font: "'Space Grotesk', sans-serif", mono: "'JetBrains Mono', monospace",
}

const CATEGORIES = [
  { id: 'markets', label: '🇮🇳 Markets' },
  { id: 'economy', label: '🏦 Economy' },
  { id: 'global', label: '🌏 Global' },
  { id: 'commodities', label: '🛢 Commodities' },
  { id: 'earnings', label: '📊 Earnings' },
]

const SENTIMENT_CFG = {
  BULLISH:  { color: C.g, bg: C.gBg, icon: '🟢' },
  BEARISH:  { color: C.r, bg: C.rBg, icon: '🔴' },
  NEUTRAL:  { color: C.muted, bg: C.mutedBg, icon: '⚪' },
}

function timeAgo(d) {
  if (!d) return ''
  try {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
    return s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`
  } catch { return '' }
}

function ImpactBadge({ impact }) {
  const map = { HIGH: { c: C.r, bg: C.rBg, i: '⚡' }, MEDIUM: { c: C.a, bg: C.aBg, i: '◎' }, LOW: { c: C.g, bg: C.gBg, i: '○' } }
  const cfg = map[impact] || { c: C.muted, bg: C.mutedBg, i: '○' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: cfg.c, background: cfg.bg, border: `1px solid ${cfg.c}22` }}>
      {cfg.i} {impact} Impact
    </span>
  )
}

function SkeletonCard() {
  const shimmer = {
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
    backgroundSize: '200% 100%', borderRadius: 8, animation: 'shimmer 1.8s ease-in-out infinite',
  }
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...shimmer, height: 16, width: 96 }} />
      <div style={{ ...shimmer, height: 20, width: '100%' }} />
      <div style={{ ...shimmer, height: 16, width: '75%' }} />
      <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
        <div style={{ ...shimmer, height: 32, width: 96 }} />
        <div style={{ ...shimmer, height: 32, width: 64 }} />
      </div>
    </div>
  )
}

function NewsCard({ article }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)

  const analyze = async (e) => {
    e.stopPropagation()
    if (analysis) { setExpanded(v => !v); return }
    setLoading(true)
    try {
      const result = await analyzeNews(article.title, article.description)
      setAnalysis(result); setExpanded(true)
    } catch {
      setAnalysis({ sentiment: 'NEUTRAL', impact: 'LOW', affectedStocks: [], affectedSectors: [], summary: 'Analysis unavailable — add ANTHROPIC_API_KEY to worker secrets.', timeframe: 'unknown' })
      setExpanded(true)
    } finally { setLoading(false) }
  }

  const sentCfg = analysis ? (SENTIMENT_CFG[analysis.sentiment] || SENTIMENT_CFG.NEUTRAL) : null

  return (
    <div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? C.cardHover : C.card, border: `1px solid ${hovered ? C.borderHover : C.border}`,
        borderRadius: 16, padding: 20, transition: 'all 0.3s', backdropFilter: 'blur(20px)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {article.source && (
          <span style={{ alignSelf: 'flex-start', padding: '4px 10px', borderRadius: 6, background: C.pBg, color: C.p, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {article.source}
          </span>
        )}
        <h3 style={{ color: hovered ? C.p : C.fg, fontWeight: 600, fontSize: 15, lineHeight: 1.45, margin: 0, transition: 'color 0.2s', cursor: 'pointer' }}>
          {article.title}
        </h3>
        {article.description && (
          <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {article.description}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
          <span style={{ fontSize: 11, color: C.muted, fontFamily: C.mono }}>{timeAgo(article.pubDate)}</span>
          <button
            onClick={analyze} disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 12,
              fontSize: 12, fontWeight: 600, border: 'none', cursor: loading ? 'wait' : 'pointer',
              background: C.pBg, color: C.p, fontFamily: C.font, transition: 'background 0.2s',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, border: `2px solid ${C.p}44`, borderTop: `2px solid ${C.p}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Analysing…
              </span>
            ) : analysis ? (expanded ? '▲ Hide' : '▼ Analysis') : '🤖 Analyse'}
          </button>
        </div>
      </div>

      {expanded && analysis && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp 0.25s ease-out' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: sentCfg.bg, color: sentCfg.color }}>
              {sentCfg.icon} {analysis.sentiment}
            </span>
            <ImpactBadge impact={analysis.impact} />
            {analysis.timeframe && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, fontSize: 12, color: C.muted, background: C.mutedBg, border: `1px solid ${C.border}` }}>
                ⏱ {analysis.timeframe}
              </span>
            )}
          </div>

          <p style={{ fontSize: 13, color: C.secondaryFg, lineHeight: 1.65, margin: 0 }}>{analysis.summary}</p>

          {analysis.affectedStocks?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h4 style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Affected Stocks</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {analysis.affectedStocks.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, background: C.mutedBg, fontSize: 13 }}>
                    <span style={{ color: s.direction === 'UP' ? C.g : C.r }}>{s.direction === 'UP' ? '▲' : '▼'}</span>
                    <span style={{ fontWeight: 600, fontFamily: C.mono, color: C.fg }}>{s.symbol}</span>
                    <span style={{ color: C.muted }}>— {s.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.affectedSectors?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {analysis.affectedSectors.map(s => (
                <span key={s} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: C.secondary, color: C.secondaryFg, border: `1px solid ${C.border}` }}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function News() {
  const [cat, setCat] = useState('markets')
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ts, setTs] = useState(null)

  const load = useCallback(async (category) => {
    setLoading(true); setError(null)
    try {
      const data = await getNews(category)
      setArticles(data.articles || []); setTs(new Date())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(cat) }, [cat])

  return (
    <>
      <style>{fonts}{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{height:4px} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}
      `}</style>
      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: C.font, color: C.fg }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, margin: 0 }}>News & Analysis</h1>
              <p style={{ fontSize: 13, color: C.muted, marginTop: 4, fontFamily: C.mono }}>
                {articles.length} articles{ts && ` · ${ts.toLocaleTimeString()}`}
              </p>
            </div>
            <button
              onClick={() => load(cat)} disabled={loading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12,
                fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: C.font,
                background: loading ? `${C.p}66` : C.p, color: C.pFg, boxShadow: `0 4px 16px ${C.p}33`,
                transition: 'all 0.2s',
              }}
            >
              <span style={loading ? { animation: 'spin 1s linear infinite', display: 'inline-block' } : {}}>⟳</span>
              Refresh
            </button>
          </div>

          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {CATEGORIES.map(c => (
              <button
                key={c.id} onClick={() => setCat(c.id)}
                style={{
                  flexShrink: 0, padding: '8px 16px', borderRadius: 11, cursor: 'pointer', fontFamily: C.font,
                  whiteSpace: 'nowrap', fontSize: 13, transition: 'all 0.2s',
                  background: cat === c.id ? C.p : C.secondary,
                  color: cat === c.id ? C.pFg : C.muted,
                  fontWeight: cat === c.id ? 700 : 400,
                  border: cat === c.id ? 'none' : `1px solid ${C.border}`,
                  boxShadow: cat === c.id ? `0 4px 16px ${C.p}33` : 'none',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* AI Hint */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, backdropFilter: 'blur(20px)' }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <p style={{ color: C.muted, margin: 0 }}>
              Click <span style={{ color: C.p, fontWeight: 600 }}>Analyse</span> on any article for AI-powered stock impact analysis.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: C.rBg, border: `1px solid ${C.r}33`, color: C.r, borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 500 }}>
              ⚠ {error}
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : articles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>📭</p>
              <p style={{ fontWeight: 500 }}>No articles found. Try refreshing.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {articles.map((a, i) => <NewsCard key={i} article={a} />)}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
