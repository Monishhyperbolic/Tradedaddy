import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getNews, analyzeNews } from '../utils/api'

const CATEGORIES = [
  { id: 'markets', label: '🇮🇳 Markets' },
  { id: 'economy', label: '🏦 Economy' },
  { id: 'global', label: '🌏 Global' },
  { id: 'commodities', label: '🛢 Commodities' },
  { id: 'earnings', label: '📊 Earnings' },
]

const SENTIMENT_CFG = {
  BULLISH: { color: 'text-success', bg: 'bg-success/10', icon: '🟢' },
  BEARISH: { color: 'text-destructive', bg: 'bg-destructive/10', icon: '🔴' },
  NEUTRAL: { color: 'text-muted-foreground', bg: 'bg-muted', icon: '⚪' },
}

function ImpactBadge({ impact }) {
  const styles = {
    HIGH: 'text-destructive bg-destructive/10 border-destructive/20',
    MEDIUM: 'text-warning bg-warning/10 border-warning/20',
    LOW: 'text-success bg-success/10 border-success/20',
  }
  const icons = { HIGH: '⚡', MEDIUM: '◎', LOW: '○' }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[impact] || 'text-muted-foreground bg-muted border-border'}`}>
      {icons[impact] || '○'} {impact} Impact
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="glass-surface rounded-2xl p-5 space-y-3">
      <div className="shimmer h-4 w-24 rounded-lg" />
      <div className="shimmer h-5 w-full rounded-lg" />
      <div className="shimmer h-4 w-3/4 rounded-lg" />
      <div className="flex gap-2 pt-2">
        <div className="shimmer h-8 w-24 rounded-lg" />
        <div className="shimmer h-8 w-16 rounded-lg" />
      </div>
    </div>
  )
}

function NewsCard({ article }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const analyze = async (e) => {
    e.stopPropagation()
    if (analysis) { setExpanded(v => !v); return }

    setLoading(true)
    try {
      const result = await analyzeNews(article.title, article.description)
      setAnalysis(result)
      setExpanded(true)
    } catch {
      setAnalysis({
        sentiment: 'NEUTRAL',
        impact: 'LOW',
        affectedStocks: [],
        affectedSectors: [],
        summary: 'Analysis unavailable — add ANTHROPIC_API_KEY to worker secrets.',
        timeframe: 'unknown'
      })
      setExpanded(true)
    } finally {
      setLoading(false)
    }
  }

  const sentCfg = analysis ? (SENTIMENT_CFG[analysis.sentiment] || SENTIMENT_CFG.NEUTRAL) : null

  const timeAgo = (d) => {
    if (!d) return ''
    try {
      const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
      return s < 3600
        ? `${Math.floor(s / 60)}m ago`
        : s < 86400
        ? `${Math.floor(s / 3600)}h ago`
        : `${Math.floor(s / 86400)}d ago`
    } catch {
      return ''
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-surface glass-surface-hover rounded-2xl p-5 group"
    >
      <div className="space-y-3">
        {article.source && (
          <span className="inline-block px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase">
            {article.source}
          </span>
        )}

        <h3 className="text-foreground font-semibold text-base leading-snug group-hover:text-primary transition-colors duration-200 cursor-pointer">
          {article.title}
        </h3>

        {article.description && (
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
            {article.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground font-mono">
            {timeAgo(article.pubDate)}
          </span>

          <button
            onClick={analyze}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold
              bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50
              transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Analysing…
              </span>
            ) : analysis ? (
              expanded ? '▲ Hide' : '▼ Analysis'
            ) : (
              '🤖 Analyse'
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && analysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${sentCfg?.bg} ${sentCfg?.color}`}>
                  {sentCfg?.icon} {analysis.sentiment}
                </span>

                <ImpactBadge impact={analysis.impact} />

                {analysis.timeframe && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground bg-muted border border-border">
                    ⏱ {analysis.timeframe}
                  </span>
                )}
              </div>

              <p className="text-sm text-secondary-foreground leading-relaxed">
                {analysis.summary}
              </p>

              {analysis.affectedStocks?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Affected Stocks
                  </h4>

                  <div className="space-y-1.5">
                    {analysis.affectedStocks.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 text-sm">
                        <span className={s.direction === 'UP' ? 'text-success' : 'text-destructive'}>
                          {s.direction === 'UP' ? '▲' : '▼'}
                        </span>
                        <span className="font-semibold font-mono text-foreground">{s.symbol}</span>
                        <span className="text-muted-foreground">— {s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.affectedSectors?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.affectedSectors.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function News() {
  const [cat, setCat] = useState('markets')
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ts, setTs] = useState(null)

  const load = useCallback(async (category) => {
    setLoading(true)
    setError(null)

    try {
      const data = await getNews(category)
      setArticles(data.articles || [])
      setTs(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(cat)
  }, [cat])

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              News & Analysis
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              {articles.length} articles {ts && `· ${ts.toLocaleTimeString()}`}
            </p>
          </div>

          <button
            onClick={() => load(cat)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm
              bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <span className={loading ? 'animate-spin' : ''}>⟳</span>
            Refresh
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium
                ${cat === c.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground'
                }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl px-4 py-3 text-sm">
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No articles found
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((a, i) => (
              <NewsCard key={i} article={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}