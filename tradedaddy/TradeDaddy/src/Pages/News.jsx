import { useState, useEffect, useCallback } from 'react'
import { getNews, analyzeNews } from '../api' // adjust path if needed

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
return s < 3600 ? `${Math.floor(s / 60)}m ago`
: s < 86400 ? `${Math.floor(s / 3600)}h ago`
: `${Math.floor(s / 86400)}d ago`
} catch { return '' }
}

function ImpactBadge({ impact }) {
const map = {
HIGH: { c: C.r, bg: C.rBg, i: '⚡' },
MEDIUM: { c: C.a, bg: C.aBg, i: '◎' },
LOW: { c: C.g, bg: C.gBg, i: '○' }
}
const cfg = map[impact] || { c: C.muted, bg: C.mutedBg, i: '○' }

return (
<span style={{
padding: '4px 10px',
borderRadius: 999,
fontSize: 12,
fontWeight: 600,
color: cfg.c,
background: cfg.bg
}}>
{cfg.i} {impact} </span>
)
}

function NewsCard({ article }) {
const [analysis, setAnalysis] = useState(null)
const [loading, setLoading] = useState(false)

const analyze = async () => {
if (analysis) return

```
setLoading(true)
try {
  const res = await analyzeNews(article.title, article.description)
  setAnalysis(res)
} catch {
  setAnalysis({ sentiment: 'NEUTRAL', impact: 'LOW', summary: 'Analysis failed' })
}
setLoading(false)
```

}

const sent = analysis ? SENTIMENT_CFG[analysis.sentiment] : null

return (
<div style={{ background: C.card, padding: 16, borderRadius: 12 }}> <h3>{article.title}</h3>
<p style={{ color: C.muted }}>{article.description}</p>

```
  <button onClick={analyze} disabled={loading}>
    {loading ? 'Loading...' : 'Analyse'}
  </button>

  {analysis && (
    <div style={{ marginTop: 10 }}>
      <span style={{ color: sent.color }}>{sent.icon} {analysis.sentiment}</span>
      <ImpactBadge impact={analysis.impact} />
      <p>{analysis.summary}</p>
    </div>
  )}
</div>
```

)
}

export default function News() {
const [cat, setCat] = useState('markets')
const [articles, setArticles] = useState([])
const [loading, setLoading] = useState(true)

const load = useCallback(async (category) => {
setLoading(true)
try {
const data = await getNews(category)
setArticles(data.articles || [])
} catch {
setArticles([])
}
setLoading(false)
}, [])

useEffect(() => {
load(cat)
}, [cat])

return (
<div style={{ padding: 20, background: C.bg, color: C.fg }}> <h1>News</h1>

```
  <div>
    {CATEGORIES.map(c => (
      <button key={c.id} onClick={() => setCat(c.id)}>
        {c.label}
      </button>
    ))}
  </div>

  {loading ? (
    <p>Loading...</p>
  ) : (
    articles.map((a, i) => <NewsCard key={i} article={a} />)
  )}
</div>
```

)
}
