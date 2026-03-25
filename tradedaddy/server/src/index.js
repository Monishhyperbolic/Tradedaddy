/**
 * TradeDaddy API — Cloudflare Worker
 * Stack: Hono + D1 (database) + R2 (images) + KV (cache)
 *
 * Deploy: npm run deploy
 * Local:  npm run dev
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

/* ─────────────────────────────────────────────────────────────────
   CORS — allow Cloudflare Pages + local dev
───────────────────────────────────────────────────────────────── */
app.use('*', cors({
  origin: (origin) => origin, // Allow all origins — restrict to your domain in production
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))

/* ─────────────────────────────────────────────────────────────────
   HEALTH
───────────────────────────────────────────────────────────────── */
app.get('/api/health', (c) =>
  c.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() })
)

/* ─────────────────────────────────────────────────────────────────
   TRADES  —  D1
───────────────────────────────────────────────────────────────── */
app.get('/api/trades', async (c) => {
  try {
    const { results } = await c.env.DB
      .prepare('SELECT * FROM trades ORDER BY created_at DESC LIMIT 100')
      .all()
    return c.json(results)
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/api/trades', async (c) => {
  try {
    const body = await c.req.json()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await c.env.DB.prepare(`
      INSERT INTO trades
        (id, symbol, type, entry, exit, qty, pnl, date, emotion, discipline, setup, notes, image_url, tags, created_at)
      VALUES
        (?,  ?,      ?,    ?,     ?,    ?,   ?,   ?,    ?,       ?,          ?,     ?,     ?,         ?,    ?)
    `).bind(
      id,
      body.symbol || '',
      body.type   || 'LONG',
      body.entry  || 0,
      body.exit   || null,
      body.qty    || 1,
      body.pnl    || 0,
      body.date   || now.slice(0, 10),
      body.emotion    || '😐',
      body.discipline || 70,
      body.setup  || '',
      body.notes  || '',
      body.image_url || '',
      JSON.stringify(body.tags || []),
      now,
    ).run()

    return c.json({ id, ...body, created_at: now }, 201)
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

app.put('/api/trades/:id', async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()

    await c.env.DB.prepare(`
      UPDATE trades SET
        symbol=?, type=?, entry=?, exit=?, qty=?, pnl=?,
        date=?, emotion=?, discipline=?, setup=?, notes=?, image_url=?, tags=?
      WHERE id=?
    `).bind(
      body.symbol, body.type, body.entry, body.exit, body.qty, body.pnl,
      body.date, body.emotion, body.discipline, body.setup, body.notes,
      body.image_url || '', JSON.stringify(body.tags || []),
      id
    ).run()

    return c.json({ id, ...body })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

app.delete('/api/trades/:id', async (c) => {
  try {
    const { id } = c.req.param()
    await c.env.DB.prepare('DELETE FROM trades WHERE id = ?').bind(id).run()
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

/* ─────────────────────────────────────────────────────────────────
   HOLDINGS  —  D1
───────────────────────────────────────────────────────────────── */
app.get('/api/holdings', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT * FROM holdings ORDER BY symbol ASC')
    .all()
  return c.json(results)
})

app.post('/api/holdings', async (c) => {
  const body = await c.req.json()
  const id = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT OR REPLACE INTO holdings (id, symbol, qty, avg_price, sector, exchange, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(id, body.symbol, body.qty, body.avg_price, body.sector || '', body.exchange || 'NSE').run()
  return c.json({ id, ...body })
})

app.delete('/api/holdings/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM holdings WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

/* ─────────────────────────────────────────────────────────────────
   IMAGE UPLOAD  —  R2
   Stores to R2, returns public URL
───────────────────────────────────────────────────────────────── */
app.post('/api/upload', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400)
    }

    // Validate: only images
    if (!file.type.startsWith('image/')) {
      return c.json({ error: 'Only image files allowed' }, 400)
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: 'File too large (max 5MB)' }, 400)
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const key = `trades/${Date.now()}-${crypto.randomUUID()}.${ext}`

    await c.env.R2.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000',
      },
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    })

    const r2PublicUrl = c.env.R2_PUBLIC_URL || 'https://pub-REPLACE.r2.dev'
    const url = `${r2PublicUrl}/${key}`

    return c.json({ url, key, size: file.size, type: file.type })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

/* ─────────────────────────────────────────────────────────────────
   CHART DATA  —  Yahoo Finance proxy
   GET /api/chart/:symbol?range=3mo&interval=1d
───────────────────────────────────────────────────────────────── */
app.get('/api/chart/:symbol', async (c) => {
  const symbol  = c.req.param('symbol')
  const range    = c.req.query('range')    || '3mo'
  const interval = c.req.query('interval') || '1d'

  // Cache key
  const cacheKey = `chart:${symbol}:${range}:${interval}`

  // Check KV cache (5 min TTL for intraday, 30 min for daily)
  try {
    const cached = await c.env.CACHE.get(cacheKey, 'json')
    if (cached) return c.json({ ...cached, cached: true })
  } catch {}

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!res.ok) {
      return c.json({ error: `Yahoo Finance returned ${res.status}` }, res.status)
    }

    const data = await res.json()
    const result = data?.chart?.result?.[0]

    if (!result) {
      return c.json({ error: 'Symbol not found or no data' }, 404)
    }

    const { timestamp, meta, indicators } = result
    const quote = indicators.quote[0]

    const candles = timestamp
      .map((t, i) => ({
        time:   t,
        open:   quote.open[i]   ? +quote.open[i].toFixed(2)   : null,
        high:   quote.high[i]   ? +quote.high[i].toFixed(2)   : null,
        low:    quote.low[i]    ? +quote.low[i].toFixed(2)    : null,
        close:  quote.close[i]  ? +quote.close[i].toFixed(2)  : null,
        volume: quote.volume[i] || 0,
      }))
      .filter(c => c.open && c.high && c.low && c.close)

    const payload = {
      symbol,
      name: meta.longName || meta.shortName || symbol,
      currency: meta.currency || 'INR',
      exchange: meta.exchangeName || '',
      regularMarketPrice: meta.regularMarketPrice,
      previousClose: meta.previousClose || meta.chartPreviousClose,
      candles,
      cached: false,
    }

    // Cache: 5 min for intraday, 15 min for daily
    const ttl = interval === '1d' ? 900 : 300
    try {
      await c.env.CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: ttl })
    } catch {}

    return c.json(payload)
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

/* ─────────────────────────────────────────────────────────────────
   SCANNER  —  Breakout / Breakdown Detection
   GET /api/scanner?lookback=20&minVolRatio=1.3
   Scans entire watchlist against Yahoo Finance
───────────────────────────────────────────────────────────────── */
app.get('/api/scanner', async (c) => {
  const lookback    = parseInt(c.req.query('lookback')    || '20')
  const minVolRatio = parseFloat(c.req.query('minVolRatio') || '1.3')

  // Try cache (15 min)
  const cacheKey = `scanner:${lookback}:${minVolRatio}`
  try {
    const cached = await c.env.CACHE.get(cacheKey, 'json')
    if (cached) return c.json({ ...cached, cached: true })
  } catch {}

  // Get watchlist from DB
  let symbols = []
  try {
    const { results } = await c.env.DB.prepare('SELECT symbol FROM watchlist').all()
    symbols = results.map(r => r.symbol)
  } catch {
    // Fallback symbols
    symbols = [
      'RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','ICICIBANK.NS',
      'ITC.NS','SBIN.NS','BHARTIARTL.NS','BAJFINANCE.NS','KOTAKBANK.NS',
      'LT.NS','AXISBANK.NS','ASIANPAINT.NS','MARUTI.NS','SUNPHARMA.NS',
      'TITAN.NS','WIPRO.NS','ADANIENT.NS','NTPC.NS','POWERGRID.NS',
    ]
  }

  // Fetch all in parallel (batches of 10 to avoid rate limits)
  const batchSize = 10
  const results = []

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    const settled = await Promise.allSettled(
      batch.map(sym => scanSymbol(sym, lookback, minVolRatio))
    )
    settled.forEach(r => {
      if (r.status === 'fulfilled' && r.value) results.push(r.value)
    })
    if (i + batchSize < symbols.length) {
      await new Promise(r => setTimeout(r, 200)) // small delay between batches
    }
  }

  const breakouts  = results.filter(r => r.signal === 'BREAKOUT').sort((a, b) => b.volumeRatio - a.volumeRatio)
  const breakdowns = results.filter(r => r.signal === 'BREAKDOWN').sort((a, b) => b.volumeRatio - a.volumeRatio)

  const payload = {
    scannedAt: new Date().toISOString(),
    scannedCount: symbols.length,
    breakouts,
    breakdowns,
    total: results.length,
  }

  try {
    await c.env.CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: 900 })
  } catch {}

  return c.json(payload)
})

/* ─────────────────────────────────────────────────────────────────
   WATCHLIST CRUD
───────────────────────────────────────────────────────────────── */
app.get('/api/watchlist', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM watchlist').all()
  return c.json(results)
})

app.post('/api/watchlist', async (c) => {
  const { symbol } = await c.req.json()
  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT OR IGNORE INTO watchlist (id, symbol) VALUES (?, ?)').bind(id, symbol.toUpperCase()).run()
  return c.json({ id, symbol })
})

app.delete('/api/watchlist/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM watchlist WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

/* ─────────────────────────────────────────────────────────────────
   SCANNER HELPER
───────────────────────────────────────────────────────────────── */
async function scanSymbol(symbol, lookback = 20, minVolRatio = 1.3) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=6mo`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    if (!res.ok) return null

    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return null

    const { timestamp, meta, indicators } = result
    const { open, high, low, close, volume } = indicators.quote[0]

    // Need at least lookback + 2 candles
    if (close.length < lookback + 2) return null

    const n = close.length
    const slice = (arr, from, to) => arr.slice(from, to).filter(v => v != null)

    // Use last `lookback` candles as reference (exclude today = last candle)
    const refHigh  = Math.max(...slice(high,  n - lookback - 1, n - 1))
    const refLow   = Math.min(...slice(low,   n - lookback - 1, n - 1))
    const refVols  = slice(volume, n - lookback - 1, n - 1)
    const avgVol   = refVols.reduce((a, b) => a + b, 0) / refVols.length

    const todayClose  = close[n - 1]
    const todayHigh   = high[n - 1]
    const todayLow    = low[n - 1]
    const todayVol    = volume[n - 1] || 0
    const prevClose   = close[n - 2]
    const volRatio    = avgVol > 0 ? todayVol / avgVol : 0

    if (volRatio < minVolRatio) return null

    const isBreakout  = todayClose > refHigh
    const isBreakdown = todayClose < refLow

    if (!isBreakout && !isBreakdown) return null

    const changePct = prevClose > 0 ? ((todayClose - prevClose) / prevClose) * 100 : 0
    const name = symbol.replace('.NS', '').replace('=X', '').replace('=F', '')

    return {
      symbol,
      name,
      signal:      isBreakout ? 'BREAKOUT' : 'BREAKDOWN',
      close:       +todayClose.toFixed(2),
      changePct:   +changePct.toFixed(2),
      volume:      todayVol,
      avgVolume:   Math.round(avgVol),
      volumeRatio: +volRatio.toFixed(2),
      refHigh:     +refHigh.toFixed(2),
      refLow:      +refLow.toFixed(2),
      currency:    meta.currency || 'INR',
      exchange:    meta.exchangeName || '',
      timestamp:   timestamp[n - 1],
    }
  } catch {
    return null
  }
}

export default app
