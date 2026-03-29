# TradeDaddy Architecture - Visual Diagrams

## 1. High-Level System Overview

```
╔════════════════════════════════════════════════════════════════════════════╗
║                         TRADEDADDY ECOSYSTEM                              ║
╚════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│                   USER INTERFACES (React Components)                        │
│                                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │Dashboard │ │Analytics │ │ Scanner  │ │   News   │ │AI Chat   │ ...    │
│  │ Trading  │ │ P&L, Win │ │Breakouts │ │ Market   │ │Assistant │        │
│  │ Journal  │ │ Rate, DD │ │ Signals  │ │ Analysis │ │ (Groq)   │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                              │
│  Core Features:                                                             │
│  • Real-time equity curve visualization                                    │
│  • Trade emotion & discipline tracking                                     │
│  • Setup-based performance analysis                                        │
│  • Multi-timeframe charting (1m, 15m, 1h, 4h, 1D)                         │
│  • Portfolio allocation (pie charts)                                       │
│  • Economic calendar integration                                           │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           │ HTTPS REST API
           │ Bearer Token Auth
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              SERVERLESS API GATEWAY (Hono on Cloudflare)                    │
│                                                                              │
│  Request Pipeline:                                                          │
│  1. CORS middleware (origin validation)                                    │
│  2. Auth middleware (JWT decode from Authorization header)                 │
│  3. Route matching (RESTful endpoints)                                     │
│  4. Business logic (CRUD, aggregation, proxying)                          │
│  5. Error handling (try-catch → JSON response)                            │
│  6. Response formatting (status codes, CORS headers)                       │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ Trade Manager   │  │ Broker Bridge   │  │ AI Proxy        │            │
│  │ CRUD /trades    │  │ /broker/mt5     │  │ /api/ai         │            │
│  │ CRUD /holdings  │  │ /broker/dhan    │  │ Groq llama-70b  │            │
│  │ Watchlist /w    │  │ OAuth storage   │  │ Rate limiting   │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ Market Data     │  │ Media Mgmt      │  │ Auth Service    │            │
│  │ /chart, /quote  │  │ /upload → R2    │  │ /auth/login     │            │
│  │ /scanner        │  │ Image optimize  │  │ JWT generation  │            │
│  │ Yahoo Finance   │  │ CORS handling   │  │ Token refresh   │            │
│  │ caching         │  │                 │  │                 │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           ├─────────────────┬──────────────────┬─────────────────┐
           │                 │                  │                 │
           ▼                 ▼                  ▼                 ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌─────────────┐
│ D1 Database      │ │ R2 Object Store  │ │ KV Cache         │ │External APIs│
│ (SQLite)         │ │ (Images)         │ │ (Sessions)       │ │             │
│                  │ │                  │ │                  │ │ Groq        │
│ • trades         │ │ • Trade photos   │ │ • Auth tokens    │ │ Yahoo Fin   │
│ • holdings       │ │ • Chart exports  │ │ • Broker tokens  │ │ MetaApi     │
│ • watchlist      │ │ • Profile pics   │ │ • Market cache   │ │ Dhan SDK    │
│                  │ │ • Public URLs    │ │ • Quote snapshots│ │ News feeds  │
│ Indexes:         │ │                  │ │ • TTL-based      │ │ Econ cal    │
│ - symbol         │ │ 100GB capacity   │ │ - exp in hours   │ │             │
│ - user_id        │ │ - global CDN     │ │                  │ │ Rate: 100   │
│ - created_at     │ │ - 99.99% SLA     │ │ 5-day retention  │ │ req/min     │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └─────────────┘
```

---

## 2. Request-Response Cycle: Trade Creation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│          TRADE CREATION FLOW - From UI to Database                          │
└─────────────────────────────────────────────────────────────────────────────┘

FRONTEND (React)
================
User opens Dashboard → "Log Trade" form
  │
  ├─ Fill in:
  │   • Symbol: RELIANCE.NS
  │   • Type: LONG
  │   • Entry: 2850.50
  │   • Quantity: 10
  │   • Emotion: 😌
  │   • Setup: Breakout+MA
  │   • Image: screenshot
  │
  ├─ Form validation (onSubmit)
  │   ├─ Check: symbol not empty ✓
  │   ├─ Check: entry > 0 ✓
  │   ├─ Check: quantity > 0 ✓
  │
  └─ Call createTrade(tradeData)
       │
       └─ From api.js:
           export const createTrade = (t) => req('/api/trades', {
             method: 'POST',
             body: JSON.stringify(t)
           })
           
           ▼
           
           Retrieve token from localStorage
           Set Authorization: Bearer eyJhbG...
           
           ▼
           
           POST https://tradedaddy-api.monishpatil.workers.dev/api/trades
           Content-Type: application/json
           
           {
             "symbol": "RELIANCE.NS",
             "type": "LONG",
             "entry": 2850.50,
             "qty": 10,
             "emotion": "😌",
             "setup": "Breakout+MA",
             "notes": "Clean break above 2850"
           }


BACKEND (Cloudflare Worker)
===========================
app.post('/api/trades', async (c) => {
  try {
    // Step 1: Extract & validate JWT
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    const decoded = await verifyToken(token)  // Get user_id
    
    // Step 2: Parse request body
    const body = await c.req.json()
    
    // Step 3: Validate input
    if (!body.symbol) return c.json({ error: 'symbol required' }, 400)
    
    // Step 4: Generate UUID
    const id = crypto.randomUUID()  // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
    const now = new Date().toISOString()
    
    // Step 5: Prepare D1 INSERT
    await c.env.DB.prepare(`
      INSERT INTO trades
        (id, user_id, symbol, type, entry, exit, qty, pnl, date, emotion, setup, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,                      // f47ac10b...
      decoded.user_id,         // "user_123"
      body.symbol,             // "RELIANCE.NS"
      body.type || 'LONG',     // "LONG"
      body.entry,              // 2850.50
      body.exit || null,       // null (open trade)
      body.qty,                // 10
      body.pnl || 0,           // 0
      body.date || now.slice(0, 10),  // "2026-03-29"
      body.emotion,            // "😌"
      body.setup,              // "Breakout+MA"
      now                      // "2026-03-29T14:30:00Z"
    ).run()  // Execute
    
    // Step 6: Return response
    return c.json({
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      symbol: "RELIANCE.NS",
      type: "LONG",
      entry: 2850.50,
      qty: 10,
      emotion: "😌",
      setup: "Breakout+MA",
      created_at: "2026-03-29T14:30:00Z"
    }, 201)
    
  } catch (e) {
    // Error handling
    if (e.message.includes('UNIQUE constraint')) {
      return c.json({ error: 'Duplicate trade' }, 409)
    }
    if (e.message.includes('FOREIGN KEY')) {
      return c.json({ error: 'Invalid user' }, 400)
    }
    return c.json({ error: e.message }, 500)
  }
})


RESPONSE BACK TO FRONTEND
=========================
HTTP/1.1 201 Created
Content-Type: application/json
Access-Control-Allow-Origin: https://tradedaddy.pages.dev

{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "symbol": "RELIANCE.NS",
  "type": "LONG",
  "entry": 2850.50,
  "qty": 10,
  "emotion": "😌",
  "setup": "Breakout+MA",
  "created_at": "2026-03-29T14:30:00Z"
}


FRONTEND UPDATE
===============
.then(newTrade => {
  setTrades([newTrade, ...trades])  // Add to top of list
  toast("✓ Trade logged!")          // Show success message
  form.reset()                       // Clear form
  
  // Auto-refresh analytics
  triggerAnalyticsRecalc()
})
.catch(err => {
  if (err.message.includes('401')) {
    logoutUser()
    navigate('/auth')
  } else {
    toast("❌ " + err.message)
  }
})


DATABASE STATE AFTER
====================
D1 trades table now contains:
┌──────────────────────────────────────────────────────────────┐
│id               │user_id  │symbol       │type │entry │qty   │
├──────────────────────────────────────────────────────────────┤
│f47ac10b-58cc... │user_123 │RELIANCE.NS  │LONG │2850.5│  10  │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Error Handling Decision Tree

```
┌▶ HTTP Request Sent ──────────────────────────────────────────────────────┐
│                                                                            │
│  Network error (no internet)?                                            │
│  ├─ YES → Retry with exponential backoff (wait 100ms, 300ms, 1s...)     │
│  │        Show: "Network error. Retrying..."                             │
│  │        After 3 retries → Show: "Network offline"                      │
│  │                                                                         │
│  └─ NO → Continue...                                                      │
│          Response received from server                                    │
│          │                                                                 │
│          ▼                                                                 │
│          HTTP Status Code?                                               │
│          │                                                                 │
│          ├─ 200-299 (Success) ───────────────────────────────────┐       │
│          │   Parse JSON response                                 │       │
│          │   ├─ Valid JSON? ─┐                                  │       │
│          │   │                └─ No: Fallback to empty {}        │       │
│          │   └─ Return data to component                         │       │
│          │                                                        │       │
│          ├─ 400-499 (Client Error)                              │       │
│          │   ├─ 401 Unauthorized ─────────────────────────┐     │       │
│          │   │   logoutUser()                             │     │       │
│          │   │   Clear token & user from localStorage     │     │       │
│          │   │   window.location.href = '/auth'           │     │       │
│          │   │   (Full page reload to Auth page)          │     │       │
│          │   │                                             │     │       │
│          │   ├─ 403 Forbidden                             │     │       │
│          │   │   Show: "Access denied"                    │     │       │
│          │   │   (User exists but lacks permission)       │     │       │
│          │   │                                             │     │       │
│          │   ├─ 404 Not Found                             │     │       │
│          │   │   Show: "Resource not found"               │     │       │
│          │   │   Check route spelling                     │     │       │
│          │   │                                             │     │       │
│          │   ├─ 409 Conflict                              │     │       │
│          │   │   Show: "Duplicate entry. Reload page."    │     │       │
│          │   │   (UNIQUE constraint violation)            │     │       │
│          │   │                                             │     │       │
│          │   └─ 429 Too Many Requests                     │     │       │
│          │       Show: "Rate limited. Wait..."             │     │       │
│          │       Wait 60 seconds before retry              │     │       │
│          │                                                  │     │       │
│          ├─ 500-599 (Server Error)                        │     │       │
│          │   ├─ 500 Internal Server Error                 │     │       │
│          │   │   Retry once after 1 second                │     │       │
│          │   │   Show: "Server error. Trying again..."    │     │       │
│          │   │   On retry fail: "Please try later"        │     │       │
│          │   │                                             │     │       │
│          │   ├─ 503 Service Unavailable                   │     │       │
│          │   │   Show: "Service temporarily down"         │     │       │
│          │   │   Offer cached data from IndexedDB         │     │       │
│          │   │   Auto-retry every 30 seconds              │     │       │
│          │   │                                             │     │       │
│          │   └─ 504 Gateway Timeout                       │     │       │
│          │       Show: "Request timed out"                │     │       │
│          │       User can retry manually                  │     │       │
│          │                                                  │     │       │
│          └─ Unknown status code                           │     │       │
│              Show: "Unexpected error. Please refresh"     │     │       │
│                                                            │     │       │
└────────────────────────────────────────────────────────────┴─────┘
```

---

## 4. Communication Patterns

### Synchronous Request-Response (Most Endpoints)

```
Client                         Server
  │                              │
  ├─ GET /api/trades ────────────────→│
  │ (HTTP Request)                    │
  │                                   │ Query D1:
  │                                   │ SELECT * FROM trades
  │                                   │ WHERE user_id = ?
  │                                   │
  │←──────────────── 200 OK JSON response
  │ [{ id: "...", symbol: "...", ... }]
  │
  └─ Parse & setState(trades)
```

### Long-Running Request (AI Chat)

```
Client                         Server                     External (Groq)
  │                              │                              │
  ├─ POST /api/ai ──────────────→│                              │
  │ messages, system prompt      │                              │
  │                              ├─ Call Groq API ────────────→ │
  │                              │ llama-3.3-70b              │
  │                              │ (waiting ~2-5s)            │
  │                              │←─────── Streaming response ─ │
  │                              │ (token by token)             │
  │←─────── 200 OK + full text ──│                              │
  │ { "text": "Based on your..." }                              │
  │                              │                              │
  └─ Stream text on UI
```

### Polling Pattern (Market Data)

```
Client                         Server
  │                              │
  │ useEffect(() => {            │
  │   interval = setInterval(    │
  │     async () => {            │
  │       GET /api/quote/RELIANCE│→ Query Yahoo Finance
  │                              │ (or use KV cache)
  │←──────── 200 OK ─────────────│
  │                              │
  │       setPrice(data.price)   │
  │     }, 5000)  // every 5s    │
  │ })                           │
```

---

## 5. Authentication & Authorization Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION LIFECYCLE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

1. SIGNUP / INITIAL LOGIN
   ════════════════════════════════════
   
   User fills Auth.jsx form:
   • Email: user@example.com
   • Password: ****
   • Name: John Trader
   
   Frontend calls:
   signup(email, password, name) → POST /api/auth/signup
   
   Backend:
     ├─ Hash password (bcrypt/argon2)
     ├─ Store user record in DB
     └─ Generate JWT token
        {
          iss: "tradedaddy",
          user_id: "user_123",
          email: "user@example.com",
          exp: 1704067200,  // Unix timestamp (1 hour expiry)
          iat: 1704063600
        }
   
   Response: { token: "eyJhbG...", user: { id, email, name } }
   
   Frontend stores:
   localStorage.setItem('td_token', token)
   localStorage.setItem('td_user', JSON.stringify(user))
   
   Navigate to /dashboard


2. AUTHENTICATED REQUESTS
   ════════════════════════════════════
   
   Every API call includes Bearer token:
   
   GET /api/trades
   Authorization: Bearer eyJhbG...
   
   Backend middleware:
     ├─ Extract token from Authorization header
     ├─ Decode JWT (verify signature)
     ├─ Check expiration (exp < now?)
     │  ├─ YES → Return 401 Unauthorized
     │  └─ NO → Extract user_id
     ├─ Verify user_id in DB (not deleted?)
     └─ Continue to route handler

   Route handler uses decoded user_id:
     SELECT * FROM trades WHERE user_id = $1  ← Implicit filter


3. TOKEN EXPIRATION & REFRESH
   ════════════════════════════════════
   
   Token expires (default: 1 hour)
   
   Next API call:
   └─ Token verification fails (exp < now)
   
   Server returns:
   HTTP 401 { error: "Token expired" }
   
   Frontend (in api.js):
   if (res.status === 401) {
     logoutUser()  // Clear localStorage
     window.location.href = '/auth'  // Redirect to login
   }
   
   User must login again to get new token


4. LOGOUT
   ════════════════════════════════════
   
   User clicks "Logout" button
   
   Frontend:
   ├─ logoutUser()
   │  ├─ localStorage.removeItem('td_token')
   │  ├─ localStorage.removeItem('td_user')
   │  ├─ _token = null  // Clear memory
   │  └─ Optional: POST /api/auth/logout (for logging)
   │
   └─ Navigate to /auth
   
   Backend (optional logout endpoint):
   POST /api/auth/logout
   ├─ Blacklist token in KV (short TTL)
   ├─ Log logout event
   └─ Return 200 OK


5. PROTECTED ROUTES
   ════════════════════════════════════
   
   Router.jsx:
   
   function PrivateRoute({ children }) {
     return isLoggedIn() ? children : <Navigate to="/auth" replace />
   }
   
   isLoggedIn() = !!getStoredToken()
   
   <Route path="/dashboard" 
          element={<PrivateRoute><Dashboard /></PrivateRoute>} />
   
   If no token in storage → Immediately redirect to /auth
   (before even rendering component)
```

---

## 6. Market Data Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  YAHOO FINANCE DATA FLOW (Scanner)                          │
└─────────────────────────────────────────────────────────────────────────────┘

User clicks "Scanner" tab in Dashboard
  │
  ├─ Component mounts (useEffect)
  │  └─ scan(lookback=20, minVolRatio=1.2, category='indian', interval='1d')
  │     │
  │     └─ GET /api/scanner?lookback=20&minVolRatio=1.2&...
  │
  Backend route: app.get('/api/scanner', async (c) => {
    try {
      // 1. Determine category → symbol list
      const symbols = CATEGORY_SYMBOLS[category]  // [RELIANCE.NS, TCS.NS, ...]
      
      // 2. Fetch OHLC for each symbol (Yahoo Finance)
      for (let symbol of symbols) {
        const candles = await fetchYahooData(symbol, range, interval)
        
        // 3. Calculate indicators
        const ma20 = simpleMovingAverage(candles, 20)
        const ma50 = simpleMovingAverage(candles, 50)
        const volumes = candles.map(c => c.volume)
        
        // 4. Detect signals
        const signal = detectSignal(candles, ma20, lookback, minVolRatio)
        
        // 5. Cache in KV
        await c.env.CACHE.put(`scanner:${symbol}`, 
          JSON.stringify({ candles, signal }), 
          { expirationTtl: 3600 }  // 1 hour
        )
        
        results.push({
          symbol,
          price: candles[candles.length-1].close,
          signal: signal.type,  // BREAKOUT | BREAKDOWN | FLAT
          volume_ratio: signal.volumeRatio,
          change24h: calculateChange(candles)
        })
      }
      
      return c.json(results)
    } catch (e) {
      return c.json({ error: e.message }, 500)
    }
  })


Frontend receives results:
[
  {
    symbol: "RELIANCE.NS",
    price: 2850.50,
    signal: "BREAKOUT",
    volume_ratio: 1.45,
    change24h: 2.3
  },
  ...
]

Render in Scanner UI:
├─ Badge: "▲ Breakout"
├─ Symbol: RELIANCE.NS
├─ Price: ₹2,850.50
├─ Vol Ratio: 1.45x
├─ Change: +2.30%
└─ Click → Open ChartModal
   └─ Load lightweight-charts
      ├─ GET /api/chart/RELIANCE.NS?range=3mo&interval=1d
      ├─ Render candlesticks
      ├─ Overlay moving averages
      ├─ Mark volume bars
      └─ User can analyze setup


Caching strategy:
──────────────────
• KV stores full scan results for 1 hour
• If repeated request within 1 hour → return cached + timestamp
• Market close (4:00 PM IST) → invalidate cache
• User can force refresh → skip KV, live fetch
```

---

## 7. Multi-Broker Connection (MT5 + Dhan)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│           BROKER CONNECTION & DATA SYNC                                    │
└─────────────────────────────────────────────────────────────────────────────┘

MT5 (via MetaApi)
═══════════════════════════════════════════════════════════════════════════════

User in Dashboard → Settings → "Connect MT5"
  │
  ├─ Form: Login + Password + Server + MetaApi Token
  │
  └─ connectMt5(login, pwd, server, platform, metaapiToken)
     │
     └─ POST /api/broker/mt5/connect
        │
        Backend:
        ├─ Validate inputs (not null)
        ├─ Store credentials in Cloudflare KV (encrypted)
        │  Key: `mt5:${user_id}`
        │  Val: { login, pwd, server, token, timestamp }
        │
        ├─ Call MetaApi SDK:
        │  const account = api.metatraderAccountById(accountId)
        │  await account.connect()
        │
        ├─ If successful: return { connected: true, account: {...} }
        │  If failed:     return { error: "Invalid credentials" }, 401
        │
        └─ Store in KV cache for 24 hours
           On next app load → auto-reconnect if KV tokens valid


Periodic Sync (when user opens Holdings tab):
──────────────────────────────────────────────
GET /api/broker/mt5/positions
  │
  Backend:
  ├─ Retrieve MT5 credentials from KV
  ├─ Call MetaApi: account.getPositions()
  └─ Return live positions array
     [
       {
         id: "12345",
         symbol: "EURUSDm",
         volume: 1.5,
         openPrice: 1.0850,
         currentPrice: 1.0872,
         profit: 330  // USD
       },
       ...
     ]
  
  Frontend:
  ├─ Map positions to Holdings table
  ├─ Calculate total Forex exposure
  └─ Display with real-time P&L


DHAN (Indian Broker)
═══════════════════════════════════════════════════════════════════════════════

Similar flow but with Dhan API:

connectDhan(clientId, accessToken)
  │
  └─ POST /api/broker/dhan/connect
     │
     Backend:
     ├─ Validate OAuth token with Dhan API
     ├─ Store credentials in KV (encrypted)
     ├─ Fetch initial holdings using Dhan SDK
     └─ Return holdings snapshot


Benefits:
──────────
• Multi-account support (MT5 + Dhan simultaneously)
• Graceful fallback if one broker disconnects
• KV caching reduces API calls to brokers
• Credentials never sent to frontend (security)
• Unified Holdings view across brokers


Error Handling:
───────────────
• Broker disconnects? → Show "MT5 Offline" status
• Invalid credentials? → Prompt to reconnect
• API rate limit? → Cache last-known positions
• OAuth token expired? → Trigger re-login (OAuth flow)
```

---

## 8. Error Recovery Mechanisms

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   CIRCUIT BREAKER PATTERN (Pseudo-code)                     │
└─────────────────────────────────────────────────────────────────────────────┘

class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failCount = 0
    this.lastFailTime = null
    this.threshold = threshold
    this.timeout = timeout
  }

  async call(fn, fallback) {
    // Check if circuit is open (too many failures recently)
    if (this.isClosed()) {
      return fallback()  // Return cached/stale data
    }

    try {
      const result = await fn()
      this.recordSuccess()
      return result
    } catch (err) {
      this.recordFailure()
      return fallback()
    }
  }

  isClosed() {
    return this.failCount >= this.threshold &&
           Date.now() - this.lastFailTime < this.timeout
  }

  recordSuccess() {
    this.failCount = 0
  }

  recordFailure() {
    this.failCount++
    this.lastFailTime = Date.now()
  }
}


Usage in Scanner:
─────────────────

const yahooBreaker = new CircuitBreaker(3, 30000)

const fetchLiveQuote = async (symbol) => {
  return yahooBreaker.call(
    () => yahooBackend.getQuote(symbol),  // Try live
    () => kvCache.get(`quote:${symbol}`)  // Fallback to cached
  )
}

Behavior:
├─ Attempt 1 fails → Try live again (fail count: 1)
├─ Attempt 2 fails → Try live again (fail count: 2)
├─ Attempt 3 fails → Try live again (fail count: 3)
├─ Attempt 4 fails → Circuit opens, return cached data
├─ For next 30 seconds → All requests use cached data
├─ After 30s → Circuit resets, try live again
└─ If live succeeds → failCount resets to 0
```

---

## 9. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CI/CD & DEPLOYMENT PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

Developer Local Environment
═════════════════════════════

git branch feature/new-chart
  │
  ├─ npm install
  ├─ npm run dev          (Frontend: http://localhost:5173)
  ├─ wrangler dev         (Backend: http://localhost:8787)
  │
  └─ Edit code, test locally
     │
     ├─ Frontend:  Save → Vite hot reload
     ├─ Backend:   Save → Wrangler auto-restart
     └─ Debug in DevTools / CloudFlare logs


GitHub Push & CI
════════════════

git push origin feature/new-chart
  │
  └─ GitHub Actions workflow triggers
     │
     ├─ Job 1: Lint Frontend
     │  ├─ npm run lint
     │  └─ Report ESLint errors
     │
     ├─ Job 2: Build Frontend
     │  ├─ npm run build
     │  ├─ Generate dist/
     │  └─ Check for build errors
     │
     ├─ Job 3: Test Backend
     │  ├─ Validate Hono routes
     │  └─ Check D1 schema compatibility
     │
     └─ All pass? → Create GitHub PR


PR Review & Merge
═════════════════

Reviewer checks:
├─ Code changes (style, logic)
├─ CI checks (all green)
└─ No blocking issues

Approve + Merge to main
  │
  └─ GitHub Actions triggers deployment


PRODUCTION DEPLOYMENT
═════════════════════

Frontend (Cloudflare Pages)
───────────────────────────

git merge feature/new-chart into main
  │
  ├─ Cloudflare Pages detects push
  ├─ npm run build
  ├─ Upload dist/ to Pages CDN
  ├─ Instant global deployment (~10 seconds)
  └─ SSL/TLS auto-configured
     URL: https://tradedaddy.pages.dev


Backend (Cloudflare Worker)
────────────────────────────

npx wrangler deploy
  │
  ├─ Create deployment bundle (src/index.js)
  ├─ Bind to D1, R2, KV resources
  ├─ Deploy to Worker infrastructure
  ├─ Global edge locations (~270 datacenters)
  └─ Rolling update (no downtime)
     URL: https://tradedaddy-api.monishpatil.workers.dev


Database (Cloudflare D1)
────────────────────────

wrangler d1 execute tradedaddy-db --remote < schema.sql
wrangler d1 execute tradedaddy-db --remote < seed.sql
  │
  ├─ Apply schema changes
  ├─ Insert seed data (watchlist)
  └─ Zero downtime (schema-free operations possible)


Rollback Strategy
═════════════════

If deployment breaks production:

1. Frontend: Rollback to previous Pages deployment
   ├─ Cloudflare Pages keeps deployment history
   └─ Revert in 1 click (instant CDN refresh)

2. Backend: Revert to previous Worker version
   ├─ wrangler rollback (git revert commit)
   ├─ npx wrangler deploy
   └─ All traffic switches to previous code

3. Database: Migration rollback
   ├─ If schema broke: Restore from backup
   ├─ D1 includes automated daily backups
   └─ Point-in-time recovery available


Monitoring & Logs
═════════════════

Cloudflare Dashboard:
├─ Worker Requests (QPS, errors)
├─ D1 Query Analytics (slow queries)
├─ R2 Usage (bandwidth, storage)
├─ KV Hit Rate (cache efficiency)
└─ Error alerts (automated)

Real User Monitoring (RUM):
├─ Frontend performance metrics
├─ Time to Interactive (TTI)
├─ Core Web Vitals (CLS, FID, LCP)
└─ JavaScript errors + stack traces
```

---

## Summary Table: Architecture Components

| Layer | Component | Technology | Role | Error Handling |
|-------|-----------|-----------|------|-----------------|
| **Client** | React App | React 19, Router v7 | UI/UX, State mgmt | try-catch, error boundaries |
| **Client** | API Client | Fetch API, localStorage | HTTP requests, auth | 401 redirect, backoff retry |
| **Server** | API Gateway | Hono (Cloudflare) | Route dispatch, CORS | try-catch, status codes |
| **Server** | Auth Engine | JWT + crypto | Token validation | 401/403 responses |
| **Server** | Trade Logic | SQL (D1) | CRUD operations | Constraint checks, rollback |
| **Server** | AI Proxy | Groq API | LLM calls | Rate limit, fallback |
| **Server** | Market Data | Yahoo Finance | Quote/OHLC fetchingcache miss, stale data |
| **Server** | Broker SDK | MetaApi, Dhan | Account connection | Circuit breaker |
| **Storage** | Database | D1 (SQLite) | Persistent data | ACID transactions |
| **Storage** | Cache | Cloudflare KV | Session, quotes | TTL expiry |
| **Storage** | Object Store | R2 | Images, exports | Quota enforcement |
| **Monitoring** | Logging | Wrangler tail | Debug + incidents | Alerts triggered |

---

**Architecture Maintained**: March 2026  
**Last Revision**: Full system redesign for serverless + multi-broker  
**Team**: TradeDaddy Development
