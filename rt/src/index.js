/**
 * TradeDaddy API v4 — Cloudflare Worker
 * AI: NVIDIA NIM (OpenAI-compatible chat completions)
 * DB: Cloudflare D1  |  Storage: R2  |  Cache: KV
 *
 * Secrets needed (wrangler secret put <NAME>):
 *   JWT_SECRET        — any strong string
 *   NVIDIA_API_KEY    — from build.nvidia.com / NIM
 *   ANTHROPIC_API_KEY — optional, for news analysis fallback
 *   HF_TOKEN          — no longer needed
 *
 * After updating this file: wrangler deploy
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

/* ══════════════════════════════════════════════════════════════
   CORS — handle preflight first, then middleware
   Both tradedaddy.pages.dev and workers.dev origins allowed
══════════════════════════════════════════════════════════════ */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age':       '86400',
}

// Manual OPTIONS handler — most reliable for CF Workers
app.options('*', c => new Response(null, { status: 204, headers: CORS_HEADERS }))

// Middleware adds headers to every response
app.use('*', async (c, next) => {
  await next()
  Object.entries(CORS_HEADERS).forEach(([k, v]) => c.res.headers.set(k, v))
})

/* ══════════════════════════════════════════════════════════════
   JWT / AUTH HELPERS
══════════════════════════════════════════════════════════════ */
const enc = s => new TextEncoder().encode(s)
async function jwtKey(secret) {
  return crypto.subtle.importKey('raw', enc(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign','verify'])
}
async function signJwt(payload, secret) {
  const k = await jwtKey(secret)
  const h = btoa(JSON.stringify({alg:'HS256',typ:'JWT'})).replace(/=/g,'')
  const b = btoa(JSON.stringify(payload)).replace(/=/g,'')
  const sig = await crypto.subtle.sign('HMAC', k, enc(`${h}.${b}`))
  return `${h}.${b}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')}`
}
async function verifyJwt(token, secret) {
  try {
    const [h,b,s] = token.split('.')
    if (!h||!b||!s) return null
    const k = await jwtKey(secret)
    const sig = Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0))
    if (!await crypto.subtle.verify('HMAC', k, sig, enc(`${h}.${b}`))) return null
    const p = JSON.parse(atob(b))
    if (p.exp && Date.now()/1000 > p.exp) return null
    return p
  } catch { return null }
}
async function hashPwd(pwd, salt) {
  const k = await crypto.subtle.importKey('raw', enc(pwd), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt:enc(salt), iterations:100000, hash:'SHA-256' }, k, 256)
  return btoa(String.fromCharCode(...new Uint8Array(bits)))
}
async function authMw(c, next) {
  const a = c.req.header('Authorization')
  if (!a?.startsWith('Bearer ')) return c.json({error:'Unauthorized'}, 401)
  const p = await verifyJwt(a.slice(7), c.env.JWT_SECRET || 'TRADEDADDY_2025')
  if (!p) return c.json({error:'Invalid or expired token'}, 401)
  c.set('uid', p.sub); c.set('email', p.email)
  await next()
}

/* ══════════════════════════════════════════════════════════════
   HEALTH
══════════════════════════════════════════════════════════════ */
app.get('/api/health', c => c.json({
  status: 'ok', v: '4.0.0',
  ts: new Date().toISOString(),
  endpoints: ['/api/auth/*','/api/trades','/api/holdings','/api/quote/:symbol','/api/chart/:symbol','/api/scanner','/api/news','/api/calendar','/api/ai','/api/broker/dhan/*','/api/broker/mt5/*'],
}))

/* ══════════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════════ */
app.post('/api/auth/signup', async c => {
  try {
    const { email, password, name } = await c.req.json()
    if (!email || !password) return c.json({error:'Email and password required'}, 400)
    if (password.length < 6) return c.json({error:'Password must be 6+ chars'}, 400)
    const ex = await c.env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email.toLowerCase()).first()
    if (ex) return c.json({error:'Email already registered'}, 409)
    const id = crypto.randomUUID(), salt = crypto.randomUUID()
    const hash = await hashPwd(password, salt)
    await c.env.DB.prepare('INSERT INTO users(id,email,name,password_hash,salt)VALUES(?,?,?,?,?)')
      .bind(id, email.toLowerCase(), name || email.split('@')[0], hash, salt).run()
    const secret = c.env.JWT_SECRET || 'TRADEDADDY_2025'
    const token = await signJwt({sub:id,email:email.toLowerCase(),name,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60*60*24*30}, secret)
    return c.json({token, user:{id, email:email.toLowerCase(), name:name||email.split('@')[0]}}, 201)
  } catch(e) { return c.json({error:e.message}, 500) }
})

app.post('/api/auth/login', async c => {
  try {
    const { email, password } = await c.req.json()
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email?.toLowerCase()).first()
    if (!user) return c.json({error:'Invalid credentials'}, 401)
    const hash = await hashPwd(password, user.salt)
    if (hash !== user.password_hash) return c.json({error:'Invalid credentials'}, 401)
    const secret = c.env.JWT_SECRET || 'TRADEDADDY_2025'
    const token = await signJwt({sub:user.id,email:user.email,name:user.name,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60*60*24*30}, secret)
    return c.json({token, user:{id:user.id, email:user.email, name:user.name}})
  } catch(e) { return c.json({error:e.message}, 500) }
})

app.get('/api/auth/me', authMw, async c => {
  const user = await c.env.DB.prepare('SELECT id,email,name,created_at FROM users WHERE id=?').bind(c.get('uid')).first()
  return user ? c.json(user) : c.json({error:'Not found'}, 404)
})

/* ══════════════════════════════════════════════════════════════
   TRADES
══════════════════════════════════════════════════════════════ */
app.get('/api/trades', authMw, async c => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM trades WHERE user_id=? ORDER BY date DESC,created_at DESC LIMIT 500'
  ).bind(c.get('uid')).all()
  return c.json(results)
})
app.post('/api/trades', authMw, async c => {
  try {
    const b = await c.req.json(), id = crypto.randomUUID(), now = new Date().toISOString()
    await c.env.DB.prepare(
      'INSERT INTO trades(id,user_id,symbol,type,entry,exit,qty,pnl,date,emotion,discipline,setup,notes,image_url,tags,created_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(id,c.get('uid'),b.symbol||'',b.type||'LONG',b.entry||0,b.exit||null,b.qty||1,b.pnl||0,b.date||now.slice(0,10),b.emotion||'😐',b.discipline||70,b.setup||'',b.notes||'',b.image_url||'',JSON.stringify(b.tags||[]),now).run()
    return c.json({id,...b,created_at:now}, 201)
  } catch(e) { return c.json({error:e.message}, 500) }
})
app.put('/api/trades/:id', authMw, async c => {
  try {
    const b = await c.req.json(), {id} = c.req.param()
    await c.env.DB.prepare(
      'UPDATE trades SET symbol=?,type=?,entry=?,exit=?,qty=?,pnl=?,date=?,emotion=?,discipline=?,setup=?,notes=?,image_url=?,tags=? WHERE id=? AND user_id=?'
    ).bind(b.symbol,b.type,b.entry,b.exit,b.qty,b.pnl,b.date,b.emotion,b.discipline,b.setup,b.notes,b.image_url||'',JSON.stringify(b.tags||[]),id,c.get('uid')).run()
    return c.json({id,...b})
  } catch(e) { return c.json({error:e.message}, 500) }
})
app.delete('/api/trades/:id', authMw, async c => {
  await c.env.DB.prepare('DELETE FROM trades WHERE id=? AND user_id=?').bind(c.req.param('id'),c.get('uid')).run()
  return c.json({success:true})
})

/* ══════════════════════════════════════════════════════════════
   HOLDINGS
══════════════════════════════════════════════════════════════ */
app.get('/api/holdings', authMw, async c => {
  const {results} = await c.env.DB.prepare('SELECT * FROM holdings WHERE user_id=? ORDER BY symbol').bind(c.get('uid')).all()
  return c.json(results)
})
app.post('/api/holdings', authMw, async c => {
  const b = await c.req.json(), id = crypto.randomUUID()
  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO holdings(id,user_id,symbol,qty,avg_price,ltp,pnl,pct,sector,exchange,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,datetime('now'))"
  ).bind(id,c.get('uid'),b.symbol,b.qty,b.avg_price,b.ltp||b.avg_price,b.pnl||0,b.pct||0,b.sector||'',b.exchange||'NSE').run()
  return c.json({id,...b})
})
app.delete('/api/holdings/:id', authMw, async c => {
  await c.env.DB.prepare('DELETE FROM holdings WHERE id=? AND user_id=?').bind(c.req.param('id'),c.get('uid')).run()
  return c.json({success:true})
})
app.delete('/api/holdings', authMw, async c => {
  await c.env.DB.prepare('DELETE FROM holdings WHERE user_id=?').bind(c.get('uid')).run()
  return c.json({success:true})
})

/* ══════════════════════════════════════════════════════════════
   IMAGE UPLOAD — R2
══════════════════════════════════════════════════════════════ */
app.post('/api/upload', authMw, async c => {
  try {
    const fd = await c.req.formData(), file = fd.get('file')
    if (!file || !(file instanceof File)) return c.json({error:'No file'}, 400)
    if (!file.type.startsWith('image/')) return c.json({error:'Images only'}, 400)
    if (file.size > 5*1024*1024) return c.json({error:'Max 5MB'}, 400)
    const ext = file.name.split('.').pop() || 'jpg'
    const key = `trades/${c.get('uid')}/${Date.now()}.${ext}`
    await c.env.R2.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type, cacheControl: 'public,max-age=31536000' }
    })
    return c.json({ url: `${c.env.R2_PUBLIC_URL||'https://pub-REPLACE.r2.dev'}/${key}`, key })
  } catch(e) { return c.json({error:e.message}, 500) }
})

/* ══════════════════════════════════════════════════════════════
   NVIDIA NIM AI — /api/ai
   Powers: Chat, News Analysis, Sector Analysis
   Model: meta/llama-3.1-70b-instruct
   Set: wrangler secret put NVIDIA_API_KEY
══════════════════════════════════════════════════════════════ */
async function nimChat(messages, apiKey, maxTokens = 512, model = 'meta/llama-3.1-70b-instruct') {
  if (!apiKey) throw new Error('NVIDIA_API_KEY not set. Run: wrangler secret put NVIDIA_API_KEY')
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`NVIDIA NIM API ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || 'No response generated.'
}

// General AI chat — portfolio-aware, powered by NVIDIA NIM
app.post('/api/ai', async c => {
  try {
    const { messages, system, prompt, model } = await c.req.json()

    const nimKey = c.env.NVIDIA_API_KEY
    if (!nimKey) return c.json({
      error: 'NVIDIA_API_KEY not set. Set it with: wrangler secret put NVIDIA_API_KEY'
    }, 503)

    // Support {messages:[{role,content}]} OR {prompt, system} shorthand
    let chatMessages = []
    if (system) chatMessages.push({ role: 'system', content: system })
    if (messages && Array.isArray(messages)) chatMessages.push(...messages)
    else if (prompt) chatMessages.push({ role: 'user', content: prompt })

    if (!chatMessages.length) return c.json({ error: 'messages or prompt required' }, 400)

    // Higher token limit for chat — 800 for detailed responses
    const text = await nimChat(chatMessages, nimKey, 800, model || 'meta/llama-3.1-70b-instruct')
    return c.json({ text, model: model || 'meta/llama-3.1-70b-instruct' })
  } catch(e) { return c.json({ error: e.message }, 500) }
})

// News headline analysis — rich NIM prompt with real market context
app.post('/api/news/analyze', async c => {
  try {
    const { headline, description } = await c.req.json()
    if (!headline) return c.json({error:'headline required'}, 400)

    const nimKey = c.env.NVIDIA_API_KEY
    if (!nimKey) return c.json({
      sentiment:'NEUTRAL', impact:'LOW', affectedStocks:[], affectedSectors:[],
      summary:'Set NVIDIA_API_KEY: wrangler secret put NVIDIA_API_KEY',
      timeframe:'unknown'
    })

    const prompt = `You are an expert NSE/BSE analyst. Analyze the following news and determine its precise impact on Indian stock markets.

NEWS HEADLINE: "${headline}"
${description ? `CONTEXT: "${description.slice(0,300)}"` : ''}

Return a JSON object with this exact structure (no markdown, no extra text):
{
  "sentiment": "BULLISH" or "BEARISH" or "NEUTRAL",
  "impact": "HIGH" or "MEDIUM" or "LOW",
  "summary": "2-3 sentence analysis explaining WHY this affects markets and HOW — be specific about mechanisms (e.g. margin compression, volume growth, cost pressures, regulatory impact)",
  "affectedStocks": [
    {"symbol": "ACTUAL_NSE_TICKER", "name": "Company Name", "direction": "UP" or "DOWN", "reason": "specific reason in 8 words max"}
  ],
  "affectedSectors": ["Banking", "IT", "Auto", etc.],
  "timeframe": "immediate" or "short-term" or "long-term",
  "keyRisk": "The main counterargument or risk to this analysis in one sentence"
}

Rules:
- Use real NSE ticker symbols (e.g. HDFCBANK, RELIANCE, TCS) not generic descriptions
- List 2-5 specific stocks that will DIRECTLY move on this news
- Impact HIGH = Nifty moves >0.5%, MEDIUM = sector rotation, LOW = minor sentiment shift
- Be precise — reference actual business relationships, not generic sector correlation`

    const text = await nimChat([
      { role: 'system', content: 'You are a precise Indian stock market analyst. Return ONLY valid JSON matching the exact structure requested. No markdown fences, no preamble.' },
      { role: 'user', content: prompt }
    ], nimKey, 500, 'meta/llama-3.1-70b-instruct')

    try {
      const clean = text.replace(/```json|```/g,'').trim()
      const parsed = JSON.parse(clean)
      return c.json(parsed)
    } catch {
      // If JSON fails, extract what we can
      const sentMatch = text.match(/"sentiment"\s*:\s*"(BULLISH|BEARISH|NEUTRAL)"/)
      const impMatch  = text.match(/"impact"\s*:\s*"(HIGH|MEDIUM|LOW)"/)
      return c.json({
        sentiment: sentMatch?.[1] || 'NEUTRAL',
        impact: impMatch?.[1] || 'LOW',
        affectedStocks: [], affectedSectors: [],
        summary: text.replace(/[{}"]/g,'').slice(0, 300),
        timeframe: 'unknown', keyRisk: ''
      })
    }
  } catch(e) { return c.json({error:e.message}, 500) }
})

/* ══════════════════════════════════════════════════════════════
   SINGLE STOCK QUOTE — /api/quote/:symbol
   Works for NSE (.NS), US stocks, Forex (=X), Crypto (-USD)
══════════════════════════════════════════════════════════════ */
app.get('/api/quote/:symbol', async c => {
  const symbol = c.req.param('symbol')
  const ck = `q3:${symbol}`

  // Check KV cache (2 min)
  try {
    const cached = await c.env.CACHE.get(ck, 'json')
    if (cached) return c.json({ ...cached, cached: true })
  } catch {}

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })

    if (!res.ok) {
      // Try query2 as fallback
      const res2 = await fetch(
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      )
      if (!res2.ok) return c.json({ error: `Yahoo Finance returned ${res.status} for ${symbol}` }, 404)
      const d2 = await res2.json()
      if (!d2?.chart?.result?.[0]) return c.json({ error: `Symbol not found: ${symbol}` }, 404)
    }

    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return c.json({ error: `Symbol not found: ${symbol}` }, 404)

    const m = result.meta
    const closes = result.indicators.quote[0].close.filter(v => v != null)
    const volumes = result.indicators.quote[0].volume || []

    const price = m.regularMarketPrice ?? closes[closes.length - 1]
    const prev  = m.previousClose ?? m.chartPreviousClose ?? closes[closes.length - 2]
    const change    = price && prev ? +(price - prev).toFixed(4) : 0
    const changePct = price && prev ? +(((price - prev) / prev) * 100).toFixed(2) : 0

    const payload = {
      symbol,
      name:         (m.longName || m.shortName || symbol).replace(' Common Stock','').slice(0,40),
      price:        price ? +price.toFixed(4) : null,
      previousClose:prev  ? +prev.toFixed(4)  : null,
      change,
      changePct,
      currency:     m.currency || 'USD',
      exchange:     m.exchangeName || '',
      volume:       volumes.filter(Boolean).slice(-1)[0] || 0,
      marketCap:    m.marketCap || null,
    }

    try { await c.env.CACHE.put(ck, JSON.stringify(payload), { expirationTtl: 120 }) } catch {}
    return c.json(payload)
  } catch(e) { return c.json({ error: e.message, symbol }, 500) }
})

/* ══════════════════════════════════════════════════════════════
   CHART DATA — /api/chart/:symbol
══════════════════════════════════════════════════════════════ */
app.get('/api/chart/:symbol', async c => {
  const symbol = c.req.param('symbol')
  const range    = c.req.query('range')    || '3mo'
  const interval = c.req.query('interval') || '1d'
  const ck = `ch3:${symbol}:${range}:${interval}`

  try {
    const cached = await c.env.CACHE.get(ck, 'json')
    if (cached) return c.json({ ...cached, cached: true })
  } catch {}

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } })
    if (!res.ok) return c.json({ error: `Yahoo ${res.status} for ${symbol}` }, res.status)

    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return c.json({ error: 'Symbol not found: ' + symbol }, 404)

    const { timestamp, meta, indicators } = result
    const q = indicators.quote[0]
    const candles = timestamp.map((t, i) => ({
      time: t,
      open:   q.open[i]   ? +q.open[i].toFixed(4)   : null,
      high:   q.high[i]   ? +q.high[i].toFixed(4)   : null,
      low:    q.low[i]    ? +q.low[i].toFixed(4)    : null,
      close:  q.close[i]  ? +q.close[i].toFixed(4)  : null,
      volume: q.volume[i] || 0,
    })).filter(c => c.open && c.close)

    const payload = {
      symbol, candles,
      name:               (meta.longName || meta.shortName || symbol).slice(0,40),
      currency:           meta.currency || 'USD',
      exchange:           meta.exchangeName || '',
      regularMarketPrice: meta.regularMarketPrice,
      previousClose:      meta.previousClose || meta.chartPreviousClose,
    }
    const ttl = interval === '1d' ? 900 : interval === '1h' ? 300 : 60
    try { await c.env.CACHE.put(ck, JSON.stringify(payload), { expirationTtl: ttl }) } catch {}
    return c.json(payload)
  } catch(e) { return c.json({ error: e.message }, 500) }
})

/* ══════════════════════════════════════════════════════════════
   SCANNER — Breakout/Breakdown across 4 categories
══════════════════════════════════════════════════════════════ */
const UNIVERSE = {
  indian: ['RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','ICICIBANK.NS','HINDUNILVR.NS','ITC.NS','SBIN.NS','BHARTIARTL.NS','BAJFINANCE.NS','KOTAKBANK.NS','LT.NS','AXISBANK.NS','ASIANPAINT.NS','MARUTI.NS','SUNPHARMA.NS','TITAN.NS','WIPRO.NS','NESTLEIND.NS','ULTRACEMCO.NS','ADANIENT.NS','ADANIPORTS.NS','POWERGRID.NS','NTPC.NS','ONGC.NS','JSWSTEEL.NS','TATAMOTORS.NS','TATASTEEL.NS','TECHM.NS','HCLTECH.NS','DRREDDY.NS','CIPLA.NS','EICHERMOT.NS','BAJAJFINSV.NS','HEROMOTOCO.NS','BRITANNIA.NS','COALINDIA.NS','GRASIM.NS','INDUSINDBK.NS','DIVISLAB.NS','APOLLOHOSP.NS','SBILIFE.NS','HDFCLIFE.NS','BAJAJ-AUTO.NS','TATACONSUM.NS','PIDILITIND.NS','HAVELLS.NS','MUTHOOTFIN.NS','CHOLAFIN.NS','PAGEIND.NS','AMBUJACEM.NS','SHREECEM.NS','DMART.NS','ZOMATO.NS','IRCTC.NS','IRFC.NS','HAL.NS','BEL.NS','RECLTD.NS','PFC.NS','NHPC.NS','TATAPOWER.NS','ADANIGREEN.NS','BERGEPAINT.NS','MARICO.NS','GODREJCP.NS','COLPAL.NS','DABUR.NS','MOTHERSON.NS','SAIL.NS','NMDC.NS','HINDALCO.NS','VEDL.NS','GLENMARK.NS','AUROPHARMA.NS','LUPIN.NS','DLF.NS','GODREJPROP.NS'],
  us: ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','BRK-B','JPM','V','UNH','XOM','JNJ','WMT','MA','PG','HD','CVX','MRK','LLY','ABBV','BAC','KO','PEP','AVGO','COST','TMO','MCD','WFC','CRM','DIS','CSCO','ACN','ABT','DHR','NEE','TXN','NKE','ADBE','QCOM','INTC','AMD','NFLX','PYPL','SBUX','BA','CAT','GE','MMM','HON','IBM','GS','MS','C','AXP','SPGI','BLK','SCHW','SPY','QQQ','IWM'],
  commodities: ['GC=F','SI=F','CL=F','BZ=F','NG=F','HG=F','ZW=F','ZC=F','ZS=F','PA=F','PL=F','CC=F','KC=F','CT=F','SB=F'],
  forex: ['EURUSD=X','GBPUSD=X','USDJPY=X','USDCHF=X','AUDUSD=X','USDCAD=X','NZDUSD=X','USDINR=X','USDCNY=X','EURGBP=X','EURJPY=X','GBPJPY=X','XAUUSD=X','XAGUSD=X','BTC-USD','ETH-USD','BNB-USD','SOL-USD','ADA-USD'],
}

app.get('/api/scanner', async c => {
  const category = c.req.query('category') || 'indian'
  const lookback = parseInt(c.req.query('lookback') || '20')
  const minVol   = parseFloat(c.req.query('minVolRatio') || '1.2')
  const interval = c.req.query('interval') || '1d'
  const ck = `sc3:${category}:${lookback}:${minVol}:${interval}`

  try {
    const cached = await c.env.CACHE.get(ck, 'json')
    if (cached) return c.json({ ...cached, cached: true })
  } catch {}

  const symbols = UNIVERSE[category] || UNIVERSE.indian
  const results = []
  const RANGE_MAP = { '1m':'1d','15m':'5d','1h':'1mo','4h':'3mo','1d':'6mo' }
  const chartRange = RANGE_MAP[interval] || '6mo'
  const chartInterval = interval === '4h' ? '1h' : interval

  for (let i = 0; i < symbols.length; i += 8) {
    const batch = symbols.slice(i, i+8)
    const settled = await Promise.allSettled(batch.map(s => scanSymbol(s, lookback, minVol, chartInterval, chartRange)))
    settled.forEach(r => { if (r.status === 'fulfilled' && r.value) results.push(r.value) })
    if (i+8 < symbols.length) await new Promise(r => setTimeout(r, 120))
  }

  const payload = {
    scannedAt: new Date().toISOString(),
    scannedCount: symbols.length,
    category, interval,
    breakouts:    results.filter(r=>r.signal==='BREAKOUT').sort((a,b)=>(b.score||0)-(a.score||0)),
    breakdowns:   results.filter(r=>r.signal==='BREAKDOWN').sort((a,b)=>(b.score||0)-(a.score||0)),
    nearBreakout: results.filter(r=>r.signal==='NEAR_BREAKOUT').sort((a,b)=>b.proximity-a.proximity),
    total: results.length,
  }
  try { await c.env.CACHE.put(ck, JSON.stringify(payload), { expirationTtl: interval==='1d'?900:180 }) } catch {}
  return c.json(payload)
})

async function scanSymbol(symbol, lookback, minVolRatio, interval, range) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!res.ok) return null
    const data   = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return null

    const { timestamp, meta, indicators } = result
    const { high, low, close, volume, open: openArr } = indicators.quote[0]

    // Build clean candle array
    const candles = []
    for (let i = 0; i < close.length; i++) {
      if (close[i] && high[i] && low[i]) {
        candles.push({ t:timestamp[i], o:openArr?.[i]||close[i], h:high[i], l:low[i], c:close[i], v:volume[i]||0 })
      }
    }
    if (candles.length < lookback + 2) return null

    const n       = candles.length
    const today   = candles[n - 1]
    const prev    = candles[n - 2]

    // Reference window: lookback candles BEFORE today
    const ref     = candles.slice(Math.max(0, n - lookback - 1), n - 1)
    if (ref.length < 3) return null

    const refHigh = Math.max(...ref.map(c => c.h))
    const refLow  = Math.min(...ref.map(c => c.l))
    const avgVol  = ref.reduce((s,c) => s + c.v, 0) / ref.length

    const changePct  = +(((today.c - prev.c) / prev.c) * 100).toFixed(2)
    const volRatio   = avgVol > 0 ? +(today.v / avgVol).toFixed(2) : 0
    const candleRange = today.h - today.l
    const closePos   = candleRange > 0 ? (today.c - today.l) / candleRange : 0.5

    // ── BREAKOUT ─────────────────────────────────────────────────────────
    // Simple: close above N-day high + volume above average
    const isBreakout = today.c > refHigh && volRatio >= minVolRatio

    // ── BREAKDOWN ────────────────────────────────────────────────────────
    // Simple: close below N-day low + volume above average
    const isBreakdown = today.c < refLow && volRatio >= minVolRatio

    // ── NEAR BREAKOUT ────────────────────────────────────────────────────
    // Within 2% of the N-day high, rising today
    const proximityToHigh = +((today.c / refHigh) * 100).toFixed(2)
    const nearBreakout = !isBreakout && !isBreakdown &&
      proximityToHigh >= 98 && changePct > 0 && volRatio >= 0.8

    if (!isBreakout && !isBreakdown && !nearBreakout) return null

    // Quality score for ranking
    let score = Math.min(volRatio * 20, 50)
    score += closePos >= 0.7 ? 20 : closePos >= 0.5 ? 10 : 0
    score += Math.min(Math.abs(changePct) * 5, 30)

    const breakoutPct = isBreakout
      ? +(((today.c - refHigh) / refHigh) * 100).toFixed(2)
      : isBreakdown
        ? +(((refLow - today.c) / refLow)   * 100).toFixed(2)
        : 0

    return {
      symbol,
      name:        (meta.longName||meta.shortName||symbol).replace(' Common Stock','').replace(' Limited','').slice(0,32),
      signal:      isBreakout ? 'BREAKOUT' : isBreakdown ? 'BREAKDOWN' : 'NEAR_BREAKOUT',
      close:       +today.c.toFixed(4),
      changePct,
      volume:      today.v,
      avgVolume:   Math.round(avgVol),
      volumeRatio: volRatio,
      refHigh:     +refHigh.toFixed(4),
      refLow:      +refLow.toFixed(4),
      proximity:   proximityToHigh,
      closePos:    +closePos.toFixed(2),
      breakoutPct,
      score:       Math.round(Math.min(score, 100)),
      currency:    meta.currency || 'USD',
      exchange:    meta.exchangeName || '',
      ts:          today.t,
    }
  } catch { return null }
}


/* ══════════════════════════════════════════════════════════════
   NEWS — Google News RSS feed
══════════════════════════════════════════════════════════════ */
app.get('/api/news', async c => {
  const category = c.req.query('category') || 'markets'
  const ck = `news3:${category}`
  try {
    const cached = await c.env.CACHE.get(ck, 'json')
    if (cached) return c.json({ ...cached, cached: true })
  } catch {}

  const feeds = {
    markets:     'https://news.google.com/rss/search?q=indian+stock+market+NSE+BSE&hl=en-IN&gl=IN&ceid=IN:en',
    economy:     'https://news.google.com/rss/search?q=RBI+India+economy+GDP+inflation+rate&hl=en-IN&gl=IN&ceid=IN:en',
    global:      'https://news.google.com/rss/search?q=US+Federal+Reserve+global+markets+economy&hl=en&gl=US&ceid=US:en',
    commodities: 'https://news.google.com/rss/search?q=gold+crude+oil+commodity+price&hl=en&gl=IN&ceid=IN:en',
    earnings:    'https://news.google.com/rss/search?q=India+company+quarterly+earnings+results&hl=en-IN&gl=IN&ceid=IN:en',
  }

  try {
    const res = await fetch(feeds[category]||feeds.markets, {
      headers: { 'User-Agent':'Mozilla/5.0','Accept':'application/rss+xml,text/xml' }
    })
    if (!res.ok) return c.json({ articles:[], error:`RSS ${res.status}` })
    const xml = await res.text()
    const items = [], matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
    for (const m of matches) {
      const raw = m[1]
      const title   = (raw.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]||raw.match(/<title>(.*?)<\/title>/)?.[1]||'').trim()
      const link    = (raw.match(/<link>(.*?)<\/link>/)?.[1]||'').trim()
      const pubDate = (raw.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]||'').trim()
      const source  = (raw.match(/<source[^>]*>(.*?)<\/source>/)?.[1]||'').trim()
      const desc    = (raw.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]||raw.match(/<description>(.*?)<\/description>/)?.[1]||'').replace(/<[^>]+>/g,'').trim().slice(0,200)
      if (title && title.length > 5) items.push({ title, link, pubDate, source, description: desc })
      if (items.length >= 20) break
    }
    const payload = { articles: items, fetchedAt: new Date().toISOString(), category }
    try { await c.env.CACHE.put(ck, JSON.stringify(payload), { expirationTtl: 900 }) } catch {}
    return c.json(payload)
  } catch(e) { return c.json({ articles:[], error:e.message }) }
})

/* ══════════════════════════════════════════════════════════════
   ECONOMIC CALENDAR — Forex Factory + past event enrichment
   Past events: actual value populated from real data
   Future events: show as "Pending"
══════════════════════════════════════════════════════════════ */
app.get('/api/calendar', async c => {
  const ck = 'cal4'
  try {
    const cached = await c.env.CACHE.get(ck, 'json')
    if (cached) return c.json({ ...cached, cached: true })
  } catch {}

  const now = new Date()

  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      headers: { 'User-Agent':'Mozilla/5.0','Referer':'https://www.forexfactory.com/' }
    })
    if (res.ok) {
      const raw = await res.json()
      const events = raw.map(e => {
        const eventTime = new Date(e.date)
        const isPast = eventTime < now
        const impactLevel = e.impact === 'High' ? 'HIGH' : e.impact === 'Medium' ? 'MEDIUM' : 'LOW'
        const relevance = getIndiaRelevance(e)
        return {
          ...e,
          impactLevel,
          relevance,
          // Show actual only for past events — if FF doesn't provide it, mark clearly
          actual: isPast ? (e.actual || null) : undefined,
          // For past events with no actual, note that data isn't available
          actualLabel: isPast
            ? (e.actual ? e.actual : 'N/A')
            : 'Pending',
          isPast,
        }
      })
      const payload = { events, fetchedAt: now.toISOString(), source: 'forexfactory' }
      try { await c.env.CACHE.put(ck, JSON.stringify(payload), { expirationTtl: 3600 }) } catch {}
      return c.json(payload)
    }
  } catch {}

  // Fallback — generate this week's key events with correct past/future logic
  const events = generateCalendarFallback(now)
  return c.json({ events, fetchedAt: now.toISOString(), source: 'fallback' })
})

function getIndiaRelevance(e) {
  const t = (e.title||e.name||'').toLowerCase()
  if ((e.country||'') === 'INR') return 'HIGH'
  if (['federal reserve','fomc','fed rate','cpi','inflation','non-farm','nfp','gdp','unemployment','pmi','rbi','ism'].some(k=>t.includes(k))) return 'HIGH'
  if ((e.country||'') === 'USD') return 'MEDIUM'
  return 'LOW'
}

function generateCalendarFallback(now) {
  const events = []
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay() + 1) // Monday

  const schedule = [
    { dayOffset:0, time:'09:00', country:'INR', title:'India CPI Inflation', impact:'High', f:'5.2%', p:'4.9%', act:'5.4%' },
    { dayOffset:1, time:'08:30', country:'USD', title:'US CPI m/m', impact:'High', f:'0.3%', p:'0.2%', act:'0.4%' },
    { dayOffset:1, time:'10:00', country:'USD', title:'Core Retail Sales', impact:'Medium', f:'0.2%', p:'0.4%', act:null },
    { dayOffset:2, time:'14:00', country:'USD', title:'FOMC Meeting Minutes', impact:'High', f:'', p:'', act:null },
    { dayOffset:2, time:'09:30', country:'INR', title:'India WPI Inflation', impact:'Medium', f:'2.5%', p:'2.4%', act:null },
    { dayOffset:3, time:'08:30', country:'USD', title:'Initial Jobless Claims', impact:'Medium', f:'215K', p:'222K', act:null },
    { dayOffset:3, time:'11:30', country:'INR', title:'RBI MPC Decision', impact:'High', f:'6.50%', p:'6.50%', act:null },
    { dayOffset:4, time:'08:30', country:'USD', title:'Non-Farm Payrolls', impact:'High', f:'180K', p:'206K', act:null },
    { dayOffset:4, time:'08:30', country:'USD', title:'Unemployment Rate', impact:'High', f:'4.0%', p:'4.1%', act:null },
    { dayOffset:4, time:'10:00', country:'USD', title:'ISM Manufacturing PMI', impact:'Medium', f:'48.5', p:'47.8', act:null },
  ]

  schedule.forEach(s => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + s.dayOffset)
    const dateStr = d.toISOString().slice(0,10)
    const eventDateTime = new Date(`${dateStr}T${s.time}:00`)
    const isPast = eventDateTime < now
    events.push({
      date: dateStr,
      time: s.time,
      country: s.country,
      title: s.title,
      forecast: s.f,
      previous: s.p,
      // Only show actual for events that have passed
      actual: isPast ? (s.act || null) : undefined,
      actualLabel: isPast ? (s.act || 'N/A') : 'Pending',
      isPast,
      impact: s.impact,
      impactLevel: s.impact === 'High' ? 'HIGH' : 'MEDIUM',
      relevance: getIndiaRelevance({ title:s.title, country:s.country }),
    })
  })
  return events
}

/* ══════════════════════════════════════════════════════════════
   DHAN BROKER PROXY
══════════════════════════════════════════════════════════════ */
app.post('/api/broker/dhan/connect', authMw, async c => {
  try {
    const { clientId, accessToken } = await c.req.json()
    if (!clientId||!accessToken) return c.json({error:'clientId and accessToken required'}, 400)
    const test = await fetch('https://api.dhan.co/holdings', {
      headers: { 'access-token':accessToken, 'client-id':clientId, 'Content-Type':'application/json' }
    })
    if (!test.ok) return c.json({error:'Dhan auth failed — check credentials'}, 401)
    await c.env.CACHE.put(`dhan:${c.get('uid')}`, JSON.stringify({clientId,accessToken}), {expirationTtl:60*60*24*30})
    return c.json({connected:true})
  } catch(e) { return c.json({error:e.message}, 500) }
})
app.get('/api/broker/dhan/holdings', authMw, async c => {
  try {
    const creds = await c.env.CACHE.get(`dhan:${c.get('uid')}`, 'json')
    if (!creds) return c.json({error:'Dhan not connected. Go to Settings → Brokers'}, 400)
    const res = await fetch('https://api.dhan.co/holdings', {
      headers: { 'access-token':creds.accessToken, 'client-id':creds.clientId, 'Content-Type':'application/json' }
    })
    return c.json(await res.json())
  } catch(e) { return c.json({error:e.message}, 500) }
})
app.get('/api/broker/dhan/positions', authMw, async c => {
  try {
    const creds = await c.env.CACHE.get(`dhan:${c.get('uid')}`, 'json')
    if (!creds) return c.json({error:'Dhan not connected'}, 400)
    const res = await fetch('https://api.dhan.co/positions', {
      headers: { 'access-token':creds.accessToken, 'client-id':creds.clientId, 'Content-Type':'application/json' }
    })
    return c.json(await res.json())
  } catch(e) { return c.json({error:e.message}, 500) }
})
app.get('/api/broker/dhan/status', authMw, async c => {
  const creds = await c.env.CACHE.get(`dhan:${c.get('uid')}`, 'json')
  return c.json({connected:!!creds, clientId:creds?.clientId?`****${creds.clientId.slice(-4)}`:null})
})
app.delete('/api/broker/dhan/disconnect', authMw, async c => {
  await c.env.CACHE.delete(`dhan:${c.get('uid')}`)
  return c.json({disconnected:true})
})

/* ══════════════════════════════════════════════════════════════
   MT5 — Login + Password via MetaApi.cloud REST
   Free tier: 5 accounts, no Python script needed
   Get API token: https://app.metaapi.cloud → API access tokens
   Set: wrangler secret put METAAPI_TOKEN
══════════════════════════════════════════════════════════════ */

const METAAPI = 'https://mt-client-api-v1.agiliumtrade.ai'
const METAAPI_PROV = 'https://mt-provisioning-api-v1.agiliumtrade.ai'

// Helper: get MetaApi token (from env secret or user-provided)
function getMetaApiToken(c, userToken) {
  return userToken || c.env.METAAPI_TOKEN || null
}

// Search MetaApi's broker server database
// GET /api/broker/mt5/servers?q=Vantage&platform=mt5
app.get('/api/broker/mt5/servers', async c => {
  try {
    const q        = c.req.query('q') || ''
    const platform = c.req.query('platform') || 'mt5'
    const token    = c.env.METAAPI_TOKEN

    if (!token) return c.json({ servers: [], error: 'METAAPI_TOKEN not set' })
    if (q.length < 2) return c.json({ servers: [] })

    const res = await fetch(
      `${METAAPI_PROV}/users/current/provisioning-profiles?limit=50&version=5`,
      { headers: { 'auth-token': token } }
    )

    // Also try the broker servers search endpoint
    const brokerRes = await fetch(
      `https://mt-provisioning-api-v1.agiliumtrade.ai/users/current/mt-accounts/brokers/${encodeURIComponent(q)}`,
      { headers: { 'auth-token': token } }
    ).catch(() => null)

    let servers = []

    if (brokerRes?.ok) {
      const data = await brokerRes.json()
      servers = (Array.isArray(data) ? data : [data]).map(s => ({
        name: s.name || s.server || s,
        platform: s.platform || platform,
      })).filter(s => s.name)
    }

    // Fallback: filter from known list
    if (!servers.length) {
      const KNOWN = [
  'VantageInternational-Live',
  'VantageInternational-Live2',
  'VantageInternational-Live3',
  'VantageInternational-Live4',
  'VantageInternational-Live5',
  'VantageInternational-Live6',
  'VantageInternational-Live7',
  'VantageInternational-Live8',
  'VantageInternational-Live9',
  'VantageInternational-Live10',
  'VantageInternational-Live11',
  'VantageInternational-Live12',
  'VantageInternational-Live13',
  'VantageInternational-Live14',
  'VantageInternational-Live15',
  'VantageInternational-Live16',
  'VantageInternational-Live17',
  'VantageInternational-Live18',
  'VantageInternational-Live19',
  'VantageInternational-Live20',
  'VantageInternational-Demo',
  'VantageInternational-Demo2',
  'VantageFX-Live',
  'VantageFX-Demo',
  'Exness-MT5Real',
  'Exness-MT5Real2',
  'Exness-MT5Real3',
  'Exness-MT5Real4',
  'Exness-MT5Real5',
  'Exness-MT5Real6',
  'Exness-MT5Real7',
  'Exness-MT5Real8',
  'Exness-MT5Real9',
  'Exness-MT5Real10',
  'Exness-MT5Real11',
  'Exness-MT5Real12',
  'Exness-MT5Real13',
  'Exness-MT5Real14',
  'Exness-MT5Real15',
  'Exness-MT5Real16',
  'Exness-MT5Real17',
  'Exness-MT5Real18',
  'Exness-MT5Real19',
  'Exness-MT5Real20',
  'Exness-MT5Trial',
  'Exness-MT5Trial2',
  'Exness-MT5Trial3',
  'Exness-MT5Trial4',
  'Exness-MT5Trial5',
  'Exness-MT4Real',
  'Exness-MT4Real2',
  'Exness-MT4Real3',
  'Exness-MT4Real4',
  'Exness-MT4Real5',
  'Exness-MT4Trial',
  'Exness-MT4Trial2',
  'ICMarkets-MT5-1',
  'ICMarkets-MT5-2',
  'ICMarkets-MT5-3',
  'ICMarkets-MT5-4',
  'ICMarkets-MT5-5',
  'ICMarkets-MT5',
  'ICMarkets-MT5Live01',
  'ICMarkets-MT5Live02',
  'ICMarkets-MT5Live03',
  'ICMarkets-MT4-1',
  'ICMarkets-MT4-2',
  'ICMarkets-MT4-3',
  'ICMarkets-MT4-4',
  'ICMarkets-MT4-5',
  'ICMarkets-Demo',
  'ICMarkets-MT5-Demo01',
  'XM.COM-MT5Real',
  'XM.COM-MT5Real2',
  'XM.COM-MT5Real3',
  'XM.COM-MT5Real4',
  'XM.COM-MT5Real5',
  'XM.COM-MT5Real6',
  'XM.COM-MT5Real7',
  'XM.COM-MT5Real8',
  'XM.COM-MT5Real9',
  'XM.COM-MT5Real10',
  'XM.COM-MT5Real11',
  'XM.COM-MT5Real12',
  'XM.COM-MT5Real13',
  'XM.COM-MT5Real14',
  'XM.COM-MT5Real15',
  'XM.COM-MT5Real16',
  'XM.COM-MT5Real17',
  'XM.COM-MT5Real18',
  'XM.COM-MT5Real19',
  'XM.COM-MT5Real20',
  'XM.COM-MT5Demo',
  'XM.COM-MT4Real',
  'XM.COM-MT4Real2',
  'XM.COM-MT4Real3',
  'XM.COM-MT4Real4',
  'XM.COM-MT4Real5',
  'XM.COM-MT4Demo',
  'Pepperstone-MT5',
  'Pepperstone-MT5Live01',
  'Pepperstone-MT5Live02',
  'Pepperstone-MT5Live03',
  'Pepperstone-MT5Live04',
  'Pepperstone-MT5Live05',
  'Pepperstone-MT5-Demo',
  'Pepperstone-MT4',
  'Pepperstone-MT4-Live',
  'Pepperstone-MT4-Demo',
  'FPMarkets-MT5 Live',
  'FPMarkets-MT5 Demo',
  'FPMarkets-MT4 Live',
  'FPMarkets-MT4 Demo',
  'OctaFX-MT5',
  'OctaFX-MT5 Demo',
  'OctaFX-MT4',
  'OctaFX-MT4 Demo',
  'HFMarketsGlobal-MT5 Live',
  'HFMarketsGlobal-MT5 Demo',
  'HFMarketsGlobal-MT4 Live',
  'HFMarketsGlobal-MT4 Demo',
  'HFMarkets-MT5 Live',
  'HFMarkets-MT5 Demo',
  'HFM-MT5 Live',
  'HFM-MT5 Demo',
  'Tickmill-MT5 Live',
  'Tickmill-MT5 Demo',
  'Tickmill-MT4 Live',
  'Tickmill-MT4 Demo',
  'Tickmill-MT5Live',
  'Tickmill-MT5Demo',
  'Alpari-MT5Real1',
  'Alpari-MT5Real2',
  'Alpari-MT5Real3',
  'Alpari-MT5Real4',
  'Alpari-MT5Real5',
  'Alpari-MT5Demo',
  'Alpari-MT4Real1',
  'Alpari-MT4Real2',
  'Alpari-MT4Demo',
  'OANDA-MT5 Live',
  'OANDA-MT5 Demo',
  'OANDA-MT4 Live',
  'OANDA-MT4 Demo',
  'Admirals-MT5 Live',
  'Admirals-MT5 Demo',
  'Admirals-MT4 Live',
  'Admirals-MT4 Demo',
  'AdmiralMarkets-MT5 Live',
  'AdmiralMarkets-MT5 Demo',
  'EightCap-MT5 Live',
  'EightCap-MT5 Demo',
  'EightCap-MT4 Live',
  'EightCap-MT4 Demo',
  'Axiory-MT5 Live',
  'Axiory-MT5 Demo',
  'Axiory-MT4 Live',
  'Axiory-MT4 Demo',
  'BlackBull-MT5 Live',
  'BlackBull-MT5 Demo',
  'BlackBull-MT4 Live',
  'BlackBull-MT4 Demo',
  'ThinkMarkets-MT5 Live',
  'ThinkMarkets-MT5 Demo',
  'ThinkMarkets-MT4 Live',
  'ThinkMarkets-MT4 Demo',
  'AxiTrader-MT5 Live',
  'AxiTrader-MT5 Demo',
  'Axi-MT5 Live',
  'Axi-MT5 Demo',
  'GlobalPrime-MT5 Live',
  'GlobalPrime-MT5 Demo',
  'GlobalPrime-MT4 Live',
  'GlobalPrime-MT4 Demo',
  'FXOpen-MT5',
  'FXOpen-MT5 Live',
  'FXOpen-MT5 Demo',
  'FXOpen-MT4 Live',
  'FXOpen-MT4 Demo',
  'OANDA-MT5Live-1',
  'OANDA-MT5Live-2',
  'FOREX.com-MT5 Live',
  'FOREX.com-MT5 Demo',
  'FOREX.com-MT4 Live',
  'FOREX.com-MT4 Demo',
  'FXTM-MT5 Live',
  'FXTM-MT5 Demo',
  'FXTM-MT4 Live',
  'FXTM-MT4 Demo',
  'FBS-MT5 Real',
  'FBS-MT5 Demo',
  'FBS-MT4 Real',
  'FBS-MT4 Demo',
  'HotForex-MT5 Live',
  'HotForex-MT5 Demo',
  'HotForex-MT4 Live',
  'HotForex-MT4 Demo',
  'RoboForex-ECN',
  'RoboForex-ECN Demo',
  'RoboForex-MT5',
  'RoboForex-MT5 Demo',
  'FxPro-MT5 Real',
  'FxPro-MT5 Demo',
  'FxPro-MT4 Real',
  'FxPro-MT4 Demo',
  'FxProUK-Server',
  'FxProUK-Server2',
  'FxProUK-Demo',
  'Deriv-MT5 Real',
  'Deriv-MT5 Demo',
  'Deriv-Server',
  'Deriv-Server 02',
  'Deriv-Demo Server',
  'Deriv-Server-03',
  'Deriv-MT5Financial',
  'Deriv-MT5Synthetic',
  'ActivTrades-MT5 Live',
  'ActivTrades-MT5 Demo',
  'ActivTrades-MT4 Live',
  'ActivTrades-MT4 Demo',
  'TMGM-MT5 Live',
  'TMGM-MT5 Demo',
  'TMGM-MT4 Live',
  'TMGM-MT4 Demo',
  'TradeNation-MT5 Live',
  'TradeNation-MT5 Demo',
  'TradeNation-MT4 Live',
  'TradeNation-MT4 Demo',
  'MonetaMarkets-MT5 Live',
  'MonetaMarkets-MT5 Demo',
  'MonetaMarkets-MT4 Live',
  'MonetaMarkets-MT4 Demo',
  'FusionMarkets-MT5 Live',
  'FusionMarkets-MT5 Demo',
  'FusionMarkets-MT4 Live',
  'FusionMarkets-MT4 Demo',
  'BlueberryMarkets-MT5 Live',
  'BlueberryMarkets-MT5 Demo',
  'VTMarkets-MT5 Live',
  'VTMarkets-MT5 Demo',
  'VTMarkets-MT4 Live',
  'VTMarkets-MT4 Demo',
  'ACYSecurities-MT5 Live',
  'ACYSecurities-MT5 Demo',
  'ACYSecurities-MT4 Live',
  'ACYSecurities-MT4 Demo',
  'GOMarkets-MT5 Live',
  'GOMarkets-MT5 Demo',
  'GOMarkets-MT4 Live',
  'GOMarkets-MT4 Demo',
  'Weltrade-MT5 Live',
  'Weltrade-MT5 Demo',
  'Weltrade-MT4 Live',
  'Weltrade-MT4 Demo',
  'Valutrades-MT5 Live',
  'Valutrades-MT5 Demo',
  'Valutrades-MT4 Live',
  'Valutrades-MT4 Demo',
  'ATFX-MT5 Live',
  'ATFX-MT5 Demo',
  'ATFX-MT4 Live',
  'ATFX-MT4 Demo',
  'Errante-MT5 Live',
  'Errante-MT5 Demo',
  'Errante-MT4 Live',
  'Errante-MT4 Demo',
  'Capital.com-MT5 Live',
  'Capital.com-MT5 Demo',
  'NAGA-MT5 Live',
  'NAGA-MT5 Demo',
  'NAGA-MT4 Live',
  'NAGA-MT4 Demo',
  'Skilling-MT5 Live',
  'Skilling-MT5 Demo',
  'Skilling-MT4 Live',
  'Skilling-MT4 Demo',
  'Libertex-MT5 Live',
  'Libertex-MT5 Demo',
  'Libertex-MT4 Live',
  'Libertex-MT4 Demo',
  'T4Trade-MT5 Live',
  'T4Trade-MT5 Demo',
  'T4Trade-MT4 Live',
  'T4Trade-MT4 Demo',
  'Equiti-MT5 Live',
  'Equiti-MT5 Demo',
  'Equiti-MT4 Live',
  'Equiti-MT4 Demo',
  'IFCMarkets-MT5 Live',
  'IFCMarkets-MT5 Demo',
  'IFCMarkets-MT4 Live',
  'IFCMarkets-MT4 Demo',
  'FIBOGroup-MT5 Live',
  'FIBOGroup-MT5 Demo',
  'FIBOGroup-MT4 Live',
  'FIBOGroup-MT4 Demo',
  'Aetos-MT5 Live',
  'Aetos-MT5 Demo',
  'Aetos-MT4 Live',
  'Aetos-MT4 Demo',
  'Forex4you-MT5 Live',
  'Forex4you-MT5 Demo',
  'Forex4you-Pro STP',
  'Forex4you-Pro STP Demo',
  'InvastGlobal-MT5 Live',
  'InvastGlobal-MT5 Demo',
  'TopFX-MT5 Live',
  'TopFX-MT5 Demo',
  'TopFX-MT4 Live',
  'TopFX-MT4 Demo',
  'LMAX-MT5 Live',
  'LMAX-MT5 Demo',
  'LMAX-MT4 Live',
  'LMAX-MT4 Demo',
  'Darwinex-MT5 Live',
  'Darwinex-MT5 Demo',
  'Darwinex-MT4 Live',
  'Darwinex-MT4 Demo',
  'Swissquote-MT5 Live',
  'Swissquote-MT5 Demo',
  'Swissquote-MT4 Live',
  'Swissquote-MT4 Demo',
  'Hantec Markets-MT5 Live',
  'HantecMarkets-MT5 Live',
  'HantecMarkets-MT5 Demo',
  'ADSS-MT5 Live',
  'ADSS-MT5 Demo',
  'ADSS-MT4 Live',
  'ADSS-MT4 Demo',
  'Amana Capital-MT5 Live',
  'AmanaCapital-MT5 Live',
  'AmanaCapital-MT5 Demo',
  'SquaredFinancial-MT5 Live',
  'SquaredFinancial-MT5 Demo',
  'Just2Trade-MT5 Live',
  'Just2Trade-MT5 Demo',
  'TradeMax-MT5 Live',
  'TradeMax-MT5 Demo',
  'GBEBrokers-MT5 Live',
  'GBEBrokers-MT5 Demo',
  'Infinox-MT5 Live',
  'Infinox-MT5 Demo',
  'Infinox-MT4 Live',
  'Infinox-MT4 Demo',
  'Coinexx-Live',
  'Coinexx-Demo',
  'RawTrading-MT5 Live',
  'RawTrading-MT5 Demo',
  'KwakolMarkets-MT5 Live',
  'KwakolMarkets-MT5 Demo',
  'ScopeMarkets-MT5 Live',
  'ScopeMarkets-MT5 Demo',
  'WeTrade-MT5 Live',
  'WeTrade-MT5 Demo',
  'FXChoice-Real 5',
  'FXChoice-Demo 5',
  'FXChoice-Real',
  'FXChoice-Demo',
  'CMCMarkets-MT5 Live',
  'CMCMarkets-MT5 Demo',
  'Fortrade-MT5 Live',
  'Fortrade-MT5 Demo',
  'Fortrade-MT4 Live',
  'Fortrade-MT4 Demo',
  'Saxo Bank-MT5 Live',
  'Saxo Bank-MT5 Demo',
  'LimeTrading-MT5 Live',
  'LimeTrading-MT5 Demo',
  'UnionStandard-Live',
  'UnionStandard-Demo',
  'Finalto-MT5 Live',
  'Finalto-MT5 Demo',
  'Finalto-MT4 Live',
  'Finalto-MT4 Demo'
]
      const qLow = q.toLowerCase()
      servers = KNOWN.filter(s => s.toLowerCase().includes(qLow)).map(s => ({ name: s, platform }))
    }

    return c.json({ servers: servers.slice(0, 20) })
  } catch(e) { return c.json({ servers: [], error: e.message }) }
})

// Connect MT5 account with login + password
app.post('/api/broker/mt5/connect', authMw, async c => {
  try {
    const { login, password, server, platform = 'mt5', metaapiToken } = await c.req.json()
    if (!login || !password || !server) return c.json({ error: 'login, password, and server are required' }, 400)

    const token = getMetaApiToken(c, metaapiToken)
    if (!token) return c.json({
      error: 'METAAPI_TOKEN not configured. Get a free token at app.metaapi.cloud then run: wrangler secret put METAAPI_TOKEN'
    }, 503)

    // Return existing if same login
    const existing = await c.env.CACHE.get(`mt5creds:${c.get('uid')}`, 'json')
    if (existing?.accountId && existing.login === String(login) && existing.server === server) {
      return c.json({ connected: true, accountId: existing.accountId, login: existing.login, server, message: 'Already connected' })
    }
    // Clear old account if credentials changed
    if (existing?.accountId) {
      await c.env.CACHE.delete(`mt5creds:${c.get('uid')}`)
    }

    // Provision via MetaApi — try with provisioning profile for broader broker support
    let accountId = null, provError = null

    // First attempt: direct account creation (works for major brokers in MetaApi DB)
    const provRes = await fetch(`${METAAPI_PROV}/users/current/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'auth-token': token },
      body: JSON.stringify({
        login: String(login),
        password,
        name: `TradeDaddy-${login}`,
        server,
        platform,
        magic: 0,
        type: 'cloud',
        application: 'MetaApi',
        region: 'vint-hill',
        reliability: 'regular',
      })
    })

    if (provRes.ok) {
      accountId = (await provRes.json()).id
    } else {
      const errBody = await provRes.json().catch(() => ({}))
      const errStatus = provRes.status
      provError = errBody.message || errBody.error || String(errStatus)

      if (errStatus === 530) {
        // Server not in MetaApi DB — create a provisioning profile first
        // This allows ANY MT5 broker server to be used
        const profRes = await fetch(`${METAAPI_PROV}/users/current/provisioning-profiles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'auth-token': token },
          body: JSON.stringify({
            name: `${server}-profile`,
            version: 5,
            status: 'active',
            brokerTimezone: 'EET',
            brokerDSTSwitchTimezone: 'EET',
          })
        })

        let profileId = null
        if (profRes.ok) {
          const prof = await profRes.json()
          profileId = prof.id

          // Upload server.dat file approach — tell MetaApi to fetch broker config
          // by using the server name directly with the profile
          await fetch(`${METAAPI_PROV}/users/current/provisioning-profiles/${profileId}/servers/${encodeURIComponent(server)}`, {
            method: 'PUT',
            headers: { 'auth-token': token },
          }).catch(() => {})
        }

        // Retry account creation with or without profile
        const retryBody = {
          login: String(login), password,
          name: `TradeDaddy-${login}`,
          server, platform, magic: 0,
          type: 'cloud', application: 'MetaApi',
          region: 'vint-hill', reliability: 'regular',
        }
        if (profileId) retryBody.provisioningProfileId = profileId

        const retry = await fetch(`${METAAPI_PROV}/users/current/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'auth-token': token },
          body: JSON.stringify(retryBody)
        })

        if (retry.ok) {
          accountId = (await retry.json()).id
        } else {
          const retErr = await retry.json().catch(() => ({}))
          return c.json({
            error: `Cannot connect to broker server "${server}". ` +
              `Please verify the exact server name from your MT5 terminal: ` +
              `File → Open an Account → server name is shown in the list. ` +
              `Current error: ${retErr.message || retry.status}`
          }, 400)
        }
      } else if (errStatus === 401) {
        return c.json({ error: 'MetaApi token invalid. Run: wrangler secret put METAAPI_TOKEN (get free token at app.metaapi.cloud)' }, 401)
      } else {
        return c.json({ error: `MetaApi error ${errStatus}: ${provError}` }, 400)
      }
    }

    if (!accountId) {
      return c.json({ error: `Provisioning failed: ${provError}` }, 400)
    }

    // Wait for account to deploy (up to 45s)
    let deployed = false, connectionStatus = 'DEPLOYING'
    for (let i = 0; i < 9; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const st = await fetch(`${METAAPI_PROV}/users/current/accounts/${accountId}`, {
        headers: { 'auth-token': token }
      }).then(r => r.ok ? r.json() : null).catch(() => null)
      if (st) {
        connectionStatus = st.connectionStatus || st.state
        if (['CONNECTED', 'DEPLOYED'].includes(st.state) || st.connectionStatus === 'CONNECTED') {
          deployed = true; break
        }
        if (['DEPLOY_FAILED', 'ERROR'].includes(st.state)) break
      }
    }

    await c.env.CACHE.put(`mt5creds:${c.get('uid')}`, JSON.stringify({
      accountId, login: String(login), server, platform,
      metaapiToken: metaapiToken || null,
      connectedAt: new Date().toISOString(),
    }), { expirationTtl: 60 * 60 * 24 * 90 })

    return c.json({ connected: true, accountId, deployed, login: String(login), server, connectionStatus })
  } catch(e) { return c.json({ error: e.message }, 500) }
})

// Fetch live positions
app.get('/api/broker/mt5/positions', authMw, async c => {
  try {
    const creds = await c.env.CACHE.get(`mt5creds:${c.get('uid')}`, 'json')
    if (!creds?.accountId) return c.json({ error: 'MT5 not connected. Go to Settings → Brokers to connect.', positions: [], connected: false })

    const token = getMetaApiToken(c, creds.metaapiToken)
    if (!token) return c.json({ error: 'METAAPI_TOKEN not set', positions: [], connected: false })

    const [posRes, infoRes] = await Promise.allSettled([
      fetch(`${METAAPI}/users/current/accounts/${creds.accountId}/positions`, { headers: { 'auth-token': token } }),
      fetch(`${METAAPI}/users/current/accounts/${creds.accountId}/accountInformation`, { headers: { 'auth-token': token } }),
    ])

    let positions = []
    if (posRes.status === 'fulfilled' && posRes.value.ok) {
      const raw = await posRes.value.json()
      positions = (Array.isArray(raw) ? raw : []).map(p => ({
        ticket:       p.id,
        symbol:       p.symbol,
        type:         p.type === 'POSITION_TYPE_BUY' ? 'LONG' : 'SHORT',
        volume:       p.volume,
        openPrice:    p.openPrice,
        currentPrice: p.currentPrice,
        profit:       p.profit,
        swap:         p.swap || 0,
        commission:   p.commission || 0,
        openTime:     p.time,
        comment:      p.comment || '',
        unrealizedPnl: p.unrealizedProfit || p.profit,
      }))
    }

    let accountInfo = {}
    if (infoRes.status === 'fulfilled' && infoRes.value.ok) {
      accountInfo = await infoRes.value.json()
    }

    const payload = {
      connected: true,
      positions,
      balance:    accountInfo.balance,
      equity:     accountInfo.equity,
      margin:     accountInfo.margin,
      freeMargin: accountInfo.freeMargin,
      marginLevel: accountInfo.marginLevel,
      currency:   accountInfo.currency || 'USD',
      leverage:   accountInfo.leverage,
      server:     creds.server,
      login:      creds.login,
      lastSync:   new Date().toISOString(),
    }

    // Cache for 60 seconds
    await c.env.CACHE.put(`mt5data:${c.get('uid')}`, JSON.stringify(payload), { expirationTtl: 60 }).catch(() => {})
    return c.json(payload)
  } catch(e) { return c.json({ error: e.message, connected: false }, 500) }
})

// Account status
app.get('/api/broker/mt5/status', authMw, async c => {
  const creds = await c.env.CACHE.get(`mt5creds:${c.get('uid')}`, 'json')
  if (!creds?.accountId) return c.json({ connected: false })

  // Return cached data if fresh
  const cached = await c.env.CACHE.get(`mt5data:${c.get('uid')}`, 'json').catch(() => null)
  if (cached) return c.json({ connected: true, login: creds.login, server: creds.server, balance: cached.balance, equity: cached.equity, currency: cached.currency })

  return c.json({ connected: true, login: creds.login, server: creds.server, balance: null, equity: null })
})

// Disconnect
app.delete('/api/broker/mt5/disconnect', authMw, async c => {
  try {
    const creds = await c.env.CACHE.get(`mt5creds:${c.get('uid')}`, 'json')
    if (creds?.accountId) {
      const token = getMetaApiToken(c, creds.metaapiToken)
      if (token) {
        // Undeploy the account
        await fetch(`${METAAPI_PROV}/users/current/accounts/${creds.accountId}/undeploy`, {
          method: 'POST', headers: { 'auth-token': token }
        }).catch(() => {})
      }
    }
    await c.env.CACHE.delete(`mt5creds:${c.get('uid')}`)
    await c.env.CACHE.delete(`mt5data:${c.get('uid')}`)
    return c.json({ disconnected: true })
  } catch(e) { return c.json({ error: e.message }, 500) }
})

/* ══════════════════════════════════════════════════════════════
   WATCHLIST
══════════════════════════════════════════════════════════════ */
app.get('/api/watchlist', authMw, async c => {
  const {results} = await c.env.DB.prepare("SELECT * FROM watchlist WHERE user_id='default' OR user_id=?").bind(c.get('uid')).all()
  return c.json(results)
})
app.post('/api/watchlist', authMw, async c => {
  const {symbol} = await c.req.json(), id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT OR IGNORE INTO watchlist(id,user_id,symbol)VALUES(?,?,?)').bind(id,c.get('uid'),symbol.toUpperCase()).run()
  return c.json({id,symbol})
})
app.delete('/api/watchlist/:id', authMw, async c => {
  await c.env.DB.prepare('DELETE FROM watchlist WHERE id=? AND user_id=?').bind(c.req.param('id'),c.get('uid')).run()
  return c.json({success:true})
})

export default app