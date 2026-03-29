# TradeDaddy Quick Reference

## 📋 Project Overview

**TradeDaddy** is a full-stack trading journal & portfolio analytics platform for tracking trades, analyzing performance, and integrating with brokers.

- **Frontend**: React 19 + Vite (hosted on Cloudflare Pages)
- **Backend**: Hono on Cloudflare Workers (serverless)
- **Database**: D1 (SQLite) + R2 (images) + KV (cache)
- **AI Integration**: Groq LLM (llama-3.3-70b)
- **Brokers**: MT5 (MetaApi) + Dhan (Indian)

---

## 🏗️ Architecture at a Glance

```
User (React UI)
    ↓
API Client (Bearer Token)
    ↓
Hono Router (Cloudflare Worker)
    ↓
┌─────────────────────┬─────────────────────┬──────────────────┐
│ D1 Database         │ R2 Object Store     │ KV Cache         │
│ (trades, holdings)  │ (images, exports)   │ (tokens, quotes) │
└─────────────────────┴─────────────────────┴──────────────────┘
    ↓
External APIs (Yahoo Finance, Groq, MetaApi, Dhan)
```

---

## 🚀 Core Systems

### Authentication Flow
```
1. User signs up/logs in (Auth page)
2. Server generates JWT token
3. Token stored in localStorage
4. Bearer token sent with every API request
5. Backend validates JWT before processing
6. 401 error = redirect to /auth
```

### Trade Management
```
Log Trade → Validate → POST /api/trades → D1 INSERT → Return ID → Update UI
Analytics auto-compute (win rate, PnL, discipline, etc.)
```

### Market Scanning
```
User clicks Scanner → GET /api/scanner → Yahoo Finance → Detect signals → 
Display breakouts/breakdowns → User clicks symbol → Chart modal with lightweight-charts
```

### AI Chat
```
User asks question → Build system prompt with trade context → 
POST /api/ai → Groq API (llama-3.3-70b) → Stream response → Display in UI
```

### Broker Integration
```
User connects MT5/Dhan → Credentials stored in KV (encrypted) → 
On demand: GET /api/broker/{mt5|dhan}/positions → Return live data → 
Merge into unified Holdings view
```

---

## 🔄 Main Request Flows

### Simple GET (Trades List)
```
GET /api/trades
  ↓ (with Authorization header)
  ↓ Backend validates JWT
  ↓ Query D1: SELECT * FROM trades WHERE user_id = $1
  ↓
200 OK: [{ id, symbol, entry, pnl, ... }, ...]
```

### Create Trade
```
POST /api/trades
Body: { symbol: "RELIANCE.NS", type: "LONG", entry: 2850.50, qty: 10, ... }
  ↓
Validate inputs (not null, qty > 0, etc.)
  ↓
Generate UUID, insert into D1
  ↓
201 Created + full trade object
```

### Upload Image
```
POST /api/upload (FormData with file)
  ↓
Validate MIME type & file size
  ↓
Upload to R2, get public URL
  ↓
Return { url: "https://r2-cdn.../image.jpg" }
```

### Error Response
```
If 401 (Unauthorized):
  Frontend → logoutUser() → redirect /auth

If 400 (Bad Request):
  { error: "symbol required" }

If 500 (Server Error):
  { error: "Database connection failed" }
  Retry with backoff
```

---

## 🛠️ Tech Stack Summary

| Layer | Tech | Version |
|-------|------|---------|
| **Frontend Framework** | React | 19.2.0 |
| **Router** | React Router DOM | 7.12.0 |
| **Build Tool** | Vite | 7.2.4 |
| **Charts** | Lightweight Charts | 5.1.0 |
| **Animations** | GSAP + Motion | 3.14.2 + 12.24.7 |
| **3D Graphics** | Three.js | 0.182.0 |
| **Backend** | Hono | Latest |
| **Database** | Cloudflare D1 | SQLite |
| **Object Storage** | Cloudflare R2 | — |
| **Cache** | Cloudflare KV | — |
| **Worker** | Cloudflare Worker | — |
| **LLM** | Groq | llama-3.3-70b |
| **Linter** | ESLint | 9.39.1 |

---

## 📂 File Structure

```
tradedaddy/
├── TradeDaddy/               (Frontend - React/Vite)
│   ├── src/
│   │   ├── Pages/            (Dashboard, Auth, Analytics, Scanner, etc.)
│   │   ├── components/       (UI components, Footer, Navbar)
│   │   ├── utils/
│   │   │   └── api.js        (⭐ API client - token mgmt, all endpoints)
│   │   ├── App.jsx           (Router + PrivateRoute guards)
│   │   └── main.jsx
│   └── vite.config.js
│
├── server/                   (Backend - Hono/Cloudflare Worker)
│   ├── src/
│   │   └── index.js          (⭐ All routes: trades, holdings, ai, upload, etc.)
│   ├── schema.sql            (D1 database schema)
│   ├── requirements.txt      (Python deps - if using Flask helper)
│   ├── app.py                (Python Flask - optional reference)
│   ├── package.json
│   ├── wrangler.toml         (⭐ Cloudflare config - D1, R2, KV bindings)
│   └── render.yaml
│
└── ARCHITECTURE.md           (This document structure)
```

---

## 🔐 Security Notes

1. **Tokens**: JWT stored in localStorage → sent as Bearer in Authorization header
2. **User Isolation**: All D1 queries filter by user_id (extracted from JWT)
3. **Credentials**: Broker creds (MT5, Dhan) stored in KV, encrypted
4. **CORS**: Origin validation on backend (in production, whitelist domain)
5. **File Upload**: MIME type validation + filename sanitization

---

## ⚙️ Common Operations

### Add a New Trade Endpoint
```javascript
app.post('/api/trades/custom', async (c) => {
  try {
    // Verify auth
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    const decoded = await verifyToken(token)
    
    // Get input
    const body = await c.req.json()
    
    // Validate
    if (!body.symbol) return c.json({ error: 'symbol required' }, 400)
    
    // Execute
    const result = await c.env.DB.prepare(`
      INSERT INTO trades (id, user_id, symbol, ...)
      VALUES (?, ?, ?, ...)
    `).bind(...).run()
    
    // Return
    return c.json(result, 201)
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})
```

### Add API Function in Frontend
```javascript
// In api.js
export const getCustomData = (id) => 
  req(`/api/trades/${id}/custom`)

// In component:
useEffect(() => {
  getCustomData(tradeId)
    .then(data => setCustomData(data))
    .catch(err => toast(err.message))
}, [tradeId])
```

### Error Handling Pattern
```javascript
// In component (useEffect)
try {
  const data = await getTrades()
  setTrades(data)
} catch (err) {
  if (err.message.includes('401')) {
    // Already handled in api.js
  } else {
    setError(err.message)  // Show in UI
  }
}
```

---

## 📊 Database Schema Quick Look

### Trades
```
id, user_id, symbol, type, entry, exit, qty, pnl, date, emotion, discipline, setup, notes, image_url, tags, created_at
```
- Indexes: user_id, date DESC, symbol, setup
- User data isolated by user_id

### Holdings
```
id, user_id, symbol, qty, avg_price, sector, exchange, updated_at
```
- Unique index: (user_id, symbol)

### Watchlist
```
id, user_id, symbol, added_at
```
- Default seeds: NIFTY 50 stocks (RELIANCE, TCS, HDFCBANK, etc.)

---

## 🚨 Error Codes Reference

| Code | Meaning | Action |
|------|---------|--------|
| 200 | OK | Success, process data |
| 201 | Created | Resource created, status 201 |
| 400 | Bad Request | Invalid input, check validation |
| 401 | Unauthorized | Redirect to /auth, re-login |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate (UNIQUE constraint) |
| 429 | Too Many Requests | Rate limited, wait before retry |
| 500 | Server Error | Retry with backoff, contact support |
| 503 | Service Unavailable | Use cached data, auto-retry |

---

## 🔍 Debugging Tips

### Check API Responses
```javascript
// In browser console (DevTools)
fetch('https://tradedaddy-api.monishpatil.workers.dev/api/trades', {
  headers: { Authorization: `Bearer ${localStorage.getItem('td_token')}` }
}).then(r => r.json()).then(console.log)
```

### View Logs
```bash
# Real-time backend logs
wrangler tail

# D1 queries
wrangler d1 execute tradedaddy-db --remote "SELECT * FROM trades LIMIT 1;"
```

### Inspect Token
```javascript
// Decode JWT (online: jwt.io)
JSON.parse(atob(token.split('.')[1]))
```

### Check KV Cache
```bash
wrangler kv:key list --binding=CACHE
```

---

## 🌐 API Endpoints Cheat Sheet

```
Auth
  POST /api/auth/signup      { email, password, name } → { token, user }
  POST /api/auth/login       { email, password } → { token, user }
  GET  /api/auth/me          → { id, email, name }

Trades (CRUD)
  GET  /api/trades           → [{ id, symbol, pnl, ... }]
  POST /api/trades           { symbol, type, entry, qty, ... } → 201
  PUT  /api/trades/:id       { symbol, pnl, ... } → { id, ... }
  DEL  /api/trades/:id       → { success: true }

Holdings
  GET  /api/holdings         → [{ id, symbol, qty, ... }]
  POST /api/holdings         { symbol, qty, avg_price } → 201
  DEL  /api/holdings/:id     → { success: true }

Market Data
  GET  /api/chart/:symbol?range=3mo&interval=1d  → { candles: [...] }
  GET  /api/quote/:symbol    → { price, change, ... }
  GET  /api/scanner?category=indian&lookback=20  → [{ symbol, signal, ... }]
  GET  /api/news?category=markets → [{ headline, source, ... }]
  GET  /api/calendar         → [{ event, impact, time, ... }]

AI & Media
  POST /api/ai               { messages: [...], system: "..." } → { text: "..." }
  POST /api/upload           FormData { file } → { url: "https://..." }

Brokers
  POST /api/broker/mt5/connect      → { connected: true }
  GET  /api/broker/mt5/positions    → [{ symbol, volume, pnl, ... }]
  POST /api/broker/dhan/connect     → { connected: true }
  GET  /api/broker/dhan/holdings    → [{ symbol, qty, ... }]

Health
  GET  /api/health           → { status: "ok", version: "1.0.0", ... }
```

---

## 🚀 Quick Deploy

```bash
# Frontend
cd TradeDaddy
npm run build
# Auto-deploys to Cloudflare Pages on push

# Backend
cd server
wrangler deploy
# Deploys Hono worker to Cloudflare

# Database (if schema changed)
wrangler d1 execute tradedaddy-db --remote < schema.sql
```

---

## 📖 See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — Full detailed architecture
- [ARCHITECTURE_DIAGRAMS.md](ARCHITECTURE_DIAGRAMS.md) — Visual diagrams + flows
- [server/wrangler.toml](server/wrangler.toml) — Cloudflare configuration
- [TradeDaddy/src/utils/api.js](TradeDaddy/src/utils/api.js) — API client reference
- [server/src/index.js](server/src/index.js) — Backend routes reference

---

**Last Updated**: March 2026  
**For Questions**: Check ARCHITECTURE.md for full documentation
