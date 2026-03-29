# TradeDaddy Architecture Document

## Overview

TradeDaddy is a modern trading journal and portfolio analytics platform built with a **frontend-backend separation**, serverless architecture, and multi-broker integration. It provides traders with comprehensive trade logging, analytics, market scanning, and AI-powered insights.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER (React + Vite)                           │
├──────────────────────────┬──────────────────────────────┬──────────────────────┤
│   Dashboard              │   Analytics & Reporting      │   Market Intel       │
│   • Portfolio view       │   • Trade analysis           │   • Scanner          │
│   • Quick stats          │   • Setup win rates          │   • News feed        │
│   • Equity curve         │   • Discipline scoring       │   • Economic cal     │
│                          │   • Emotion heatmap          │   • Sector analysis  │
├──────────────────────────┴──────────────────────────────┴──────────────────────┤
│                    Local Storage (Token, User, Cache)                           │
│                         Error Handling Layer                                     │
│                       (401 → Auth, Network retry)                               │
└─────────────────────────────┬──────────────────────────────────────────────────┘
                              │ HTTP/REST API
                              │ ├─ Authorization: Bearer Token
                              │ └─ CORS enabled
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                  SERVERLESS API LAYER (Hono @ Cloudflare)                       │
├──────────────────────────┬──────────────────────────────┬──────────────────────┤
│   Trade Management       │   Broker Integration         │   AI & Market Data   │
│   • POST /api/trades     │   • /api/broker/mt5/*        │   • /api/ai          │
│   • GET  /api/trades     │   • /api/broker/dhan/*       │   • /api/scanner     │
│   • PUT  /api/trades/:id │   • Connection pooling       │   • /api/chart       │
│   • DEL  /api/trades/:id │   • Credential storage (KV)  │   • /api/news        │
│                          │                              │   • /api/calendar    │
├──────────────────────────┼──────────────────────────────┼──────────────────────┤
│   Error Handling         │   Media Upload               │   Auth & Security    │
│   • try-catch all routes │   • POST /api/upload → R2    │   • POST /auth/login │
│   • JSON error response  │   • CORS preflight           │   • JWT validation   │
│   • HTTP status codes    │   • File size limits         │   • Token refresh    │
└──────────────────────────┴──────────────────────────────┴──────────────────────┘
                ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           DATA & EXTERNAL INTEGRATIONS                       │
├──────────────────┬──────────────────────┬───────────────┬────────────────────┤
│   D1 Database    │   R2 Object Store    │   KV Cache    │   External APIs    │
│   (SQLite)       │   (Images)           │   (Auth/Data) │   • Groq AI        │
│                  │                      │               │   • Yahoo Finance  │
│   • trades       │   • Trade photos     │               │   • MetaApi        │
│   • holdings     │   • Chart exports    │               │   • Dhan broker    │
│   • watchlist    │   • Profile pics     │               │   • News feeds     │
│   • user_config  │                      │               │   • Econ calendar  │
│                  │                      │               │                    │
│   Schema:        │   Upload flow:       │   TTL-based   │   Rate limited     │
│   - PK: UUID     │   file → validate    │   expiry      │   • Auth tokens    │
│   - Indexes:     │   → upload → KV link│               │   • API calls      │
│     symbol,      │   → return public    │               │   • Streaming data │
│     user_id,     │     URL              │               │                    │
│     created_at   │                      │               │                    │
└──────────────────┴──────────────────────┴───────────────┴────────────────────┘
```

---

## Component Roles & Responsibilities

### Frontend Components

| Role | Component(s) | Responsibilities |
|------|-------------|------------------|
| **Authentication** | `Auth.jsx` | Login/signup, token storage, protected routes |
| **Data Hub** | `Dashboard.jsx` | Centralized state, navigation, real-time updates |
| **Analytics Engine** | `Analytics.jsx` | Trade statistics, setup analysis, discipline metrics |
| **Market Intelligence** | `Scanner.jsx`, `News.jsx` | Technical scanning, signal detection, news feed |
| **Visualization** | `EquityChart`, `lightweight-charts` | Portfolio curves, OHLC candlesticks, indicators |
| **Layout** | `MainLayout.jsx`, `GooeyNav.jsx` | Navigation, responsive design, modal management |
| **API Client** | `api.js` | Request handling, error management, token refresh |

### Backend Services (Hono Routes)

| Service | Endpoints | Logic | Error Handling |
|---------|-----------|-------|-----------------|
| **Trade CRUD** | `/api/trades/*` | Create, read, update, delete trades; D1 queries | `try-catch`, HTTP 500 |
| **Holdings** | `/api/holdings/*` | Portfolio position tracking | DB constraints |
| **Broker Bridge** | `/api/broker/{mt5\|dhan}/*` | Abstract broker connections, credential caching | Token expiry, reconnect retry |
| **AI Assistant** | `/api/ai` | Proxy Groq requests, system prompts for trade analysis | Rate limiting, fallback message |
| **Market Data** | `/api/chart`, `/api/quote`, `/api/scanner` | Fetch from Yahoo Finance, compute indicators | Cache miss retry loop |
| **Media** | `/api/upload` | Validate files, upload to R2, store URL | File type check, quota enforcement |
| **Auth** | `/api/auth/*` | JWT generation, password hashing, token validation | 401 Unauthorized flow |

---

## Communication Flow

### Data Flow: Trade Logging

```
User logs trade in Dashboard
  ↓
Form validation (frontend)
  ↓
createTrade(tradeData) → api.js
  ↓
POST /api/trades with Bearer token
  ↓
Hono route validates JWT
  ↓
Insert into D1 trades table (UUID, user_id, symbol, etc.)
  ↓
Return created trade object
  ↓
setState() → re-render with new entry
  ↓
Display in journal + analytics auto-update
```

### Error Handling Flow

```
API Request
  ↓
Check response.ok
  ├─ No: res.status === 401?
  │    ├─ Yes: logoutUser() → redirect /auth
  │    └─ No: Parse error JSON
  │        └─ throw Error(err.error || statusText)
  │
  ├─ UI catches in useEffect()
  │  └─ toast/snackbar notification
  │
  └─ Fallback: "Network error" message
```

### AI Chat Flow (Groq Integration)

```
User types: "Analyze my RELIANCE trades"
  ↓
Dashboard.jsx builds system prompt with trade context
  ↓
groqChat(messages, systemPrompt)
  ↓
POST /api/ai to Hono
  ↓
Hono validates authorization
  ↓
Call Groq API (llama-3.3-70b)
  ├─ Rate limited? → return "AI busy"
  └─ Success? → cache response in KV
  ↓
Stream/return markdown response
  ↓
Render in chat UI with formatting
```

---

## Tool Integrations

### External Services

| Tool | Purpose | Integration Method | Error Handling |
|------|---------|-------------------|-----------------|
| **Groq LLM** | AI chat, trade analysis | REST API via Hono proxy | HTTP 429 → backoff, fallback msg |
| **Yahoo Finance** | OHLC data, quotes, volume | yfinance-like API calls | Cache miss → retry with backoff |
| **MetaApi** | MT5 connection, positions | REST API + socket connection | Token refresh, fallback to cached data |
| **Dhan API** | Indian broker data | SDK → REST bridge | OAuth token validation, reconnect logic |
| **Supabase** | (Optional) Auth/DB backup | Configured via env vars | Graceful degradation to D1 |
| **Cloudflare R2** | Image storage | MultipartForm upload | File size validation, CORS headers |
| **Cloudflare KV** | Cache & session storage | ttl-based key-value | Stale data acceptable, fallback to DB |

### Internal Tool Flow

```
Scanner → Lightweight-charts
  ↓
Fetch OHLC from Yahoo Finance
  ↓
Calculate moving averages (MA20), volume bars
  ↓
Detect breakout/breakdown signals
  ↓
Render candlestick + overlay
  ↓
User clicks signal → preview trade details
```

---

## Error Handling Architecture

### Frontend Error Strategy

```javascript
// Layer 1: API Request Level
const req = async (path, opts) => {
  const res = await fetch(...)
  if (!res.ok) {
    if (res.status === 401) {
      logoutUser()
      window.location.href = '/auth'
    }
    throw new Error(...)  // Bubble to component
  }
}

// Layer 2: Component Level (try-catch in useEffect)
useEffect(async () => {
  try {
    const data = await getTrades()
    setTrades(data)
  } catch (err) {
    setError(err.message)  // Display toast
    // Retry with exponential backoff
  }
}, [])

// Layer 3: Route Level (PrivateRoute guard)
function PrivateRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/auth" />
}
```

### Backend Error Strategy

```javascript
// Route-level try-catch
app.post('/api/trades', async (c) => {
  try {
    const body = await c.req.json()
    // Validate: check required fields
    if (!body.symbol) {
      return c.json({ error: 'symbol required' }, 400)
    }
    
    // Execute DB command
    const result = await c.env.DB.prepare(...).run()
    return c.json(result, 201)
    
  } catch (e) {
    // Distinguish errors
    if (e.message.includes('UNIQUE constraint')) {
      return c.json({ error: 'Duplicate trade' }, 409)
    }
    return c.json({ error: e.message }, 500)
  }
})

// CORS error handling (preflight)
app.use('*', cors({
  origin: (origin) => origin,  // Log origin for debugging
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))
```

### Graceful Degradation

| Service Down | Behavior |
|--------------|----------|
| Groq AI | "AI is currently offline. Try again later." |
| Yahoo Finance | Use cached quotes from KV (up to 1 hour old) |
| MT5 Connection | Show last known positions, "Status: Offline" |
| R2 Upload | "Image upload failed. Try again or skip." |
| D1 Database | Return 503 Single-handedly (restart Worker) |

---

## Data Model

### Trades Table
```sql
CREATE TABLE trades (
  id           TEXT PRIMARY KEY,        -- UUID
  user_id      TEXT NOT NULL,           -- JWT decoded
  symbol       TEXT NOT NULL,           -- RELIANCE.NS
  type         TEXT CHECK(...),         -- LONG | SHORT
  entry        REAL NOT NULL,           -- Entry price
  exit         REAL,                    -- Nullable (open trades)
  qty          REAL NOT NULL,           -- Quantity
  pnl          REAL DEFAULT 0,          -- Profit/Loss
  date         TEXT NOT NULL,           -- YYYY-MM-DD
  emotion      TEXT DEFAULT '😐',       -- Emoji 😐😌😍😤
  discipline   INTEGER DEFAULT 70,      -- 0-100 score
  setup        TEXT DEFAULT '',         -- Tag for grouping
  notes        TEXT DEFAULT '',         -- Free text
  image_url    TEXT DEFAULT '',         -- R2 public URL
  tags         TEXT DEFAULT '[]',       -- JSON array
  created_at   TEXT NOT NULL            -- ISO 8601
);

CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_date ON trades(date DESC);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_setup ON trades(setup);
```

### Holdings Table
```sql
CREATE TABLE holdings (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  symbol       TEXT NOT NULL,
  qty          REAL NOT NULL,
  avg_price    REAL NOT NULL,
  sector       TEXT DEFAULT '',
  exchange     TEXT DEFAULT 'NSE',      -- NSE | BSE | NASDAQ
  updated_at   TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_holdings_user_symbol 
  ON holdings(user_id, symbol);
```

### Watchlist Table
```sql
CREATE TABLE watchlist (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  symbol       TEXT NOT NULL,
  added_at     TEXT NOT NULL
);
```

---

## Deployment Architecture

### Frontend
```
npm run build  →  Vite output (dist/)  →  Cloudflare Pages
                                          Static hosting
                                          Auto-deploy on push
```

### Backend
```
src/index.js  →  npm run deploy  →  Cloudflare Worker
                                     Serverless (milliseconds)
                                     Auto-scaling
                                     Linked to D1/R2/KV
```

### Environment Configuration
- **Frontend**: `BASE` constant in `api.js` 
  - Production: `https://tradedaddy-api.monishpatil.workers.dev`
  - Local dev: `http://localhost:8787`

- **Backend**: Configured via `wrangler.toml`
  ```toml
  [env.production]
  name = "tradedaddy"
  
  [[d1_databases]]
  binding = "DB"
  database_name = "tradedaddy-db"
  
  [[r2_buckets]]
  binding = "BUCKET"
  bucket_name = "tradedaddy-media"
  
  [[kv_namespaces]]
  binding = "CACHE"
  id = "xxx"
  ```

---

## Performance & Scalability

| Component | Strategy |
|-----------|----------|
| Database | D1 indexes on user_id, date, symbol |
| Images | Lazy load, R2 CDN (global), thumbnail generation |
| AI Calls | Rate limit (3 req/min), cache responses in KV |
| Charts | Lightweight-charts lib (client-side rendering), data pagination |
| State | React Query (if added) for caching, deduplication |

---

## Security Considerations

1. **Authentication**
   - JWT tokens stored in localStorage
   - Bearer token in Authorization header
   - 401 responses trigger re-auth flow

2. **Data Isolation**
   - user_id embedded in queries (no user_id param exposure)
   - All D1 queries filtered by JWT-decoded user_id

3. **API Rate Limiting**
   - TODO: Implement on Groq AI proxy (/api/ai)
   - TODO: Add CAPTCHA for auth endpoints

4. **Image Upload**
   - File type validation (MIME check)
   - File size cap (5MB default)
   - Filename sanitization (UUID rename)

5. **CORS Policy**
   - Frontend domain whitelisting (production)
   - Development: wildcard (change for prod)

---

## Summary: Agent Roles (If Extending to Autonomous Trading)

If you build autonomous trading agents in future:

| Agent | Role | Tools | Error Recovery |
|-------|------|-------|-----------------|
| **Scanner Agent** | Detect setups, generate alerts | Market data APIs, charting | Cache old data, skip alerts |
| **Risk Manager** | Validate trade sizing, drawdown | Holdings DB, portfolio math | Block orders, flag for review |
| **Analytics Agent** | Compute metrics, generate reports | SQL queries, stats library | Return partial results |
| **Notification Agent** | Send alerts, logs | Email, Slack, WebSocket | Queue for retry, in-app fallback |

---

## Quick Reference: API Endpoints

```
Auth
  POST /api/auth/signup     - Register user
  POST /api/auth/login      - Get JWT token
  GET  /api/auth/me         - Current user info

Trades
  GET  /api/trades          - List all trades
  POST /api/trades          - Create trade
  PUT  /api/trades/:id      - Update trade
  DEL  /api/trades/:id      - Delete trade

Holdings
  GET  /api/holdings        - Portfolio positions
  POST /api/holdings        - Add position
  DEL  /api/holdings/:id    - Remove position

Market Data
  GET  /api/chart/:symbol   - OHLC candlestick data
  GET  /api/quote/:symbol   - Current price
  GET  /api/scanner         - Scan for breakouts
  GET  /api/news            - Market news feed
  GET  /api/calendar        - Economic events

AI & Tools
  POST /api/ai              - Chat with Groq LLM
  POST /api/upload          - Upload trade image → R2

Brokers
  POST /api/broker/mt5/connect        - Link MT5 account
  GET  /api/broker/mt5/positions      - Open positions
  POST /api/broker/dhan/connect       - Link Dhan account
  GET  /api/broker/dhan/holdings      - Holdings snapshot

Health
  GET  /api/health          - Service status
```

---

**Last Updated**: March 2026  
**Maintainer**: Monish Patil  
**Repository**: github.com/Monishhyperbolic/Tradedaddy
