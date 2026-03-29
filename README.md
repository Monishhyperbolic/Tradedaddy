# TradeDaddy 📈

> **The Modern Trading Journal & Portfolio Analytics Platform**

A comprehensive full-stack application for traders to log trades, analyze performance, scan markets for setups, and integrate with multiple brokers—all powered by AI insights.

🌐 **Live Demo**: [https://tradedaddy.monishpatil.workers.dev/](https://tradedaddy.monishpatil.workers.dev/)

---

## ✨ Features

### 📋 Trading Journal
- **Log trades** with entry, exit, quantity, and emotion/discipline scoring
- **Trade photos** for setup documentation (uploaded to R2 CDN)
- **Tag system** for organizing trades by setup name
- **Real-time equity curve** visualization with starting capital benchmark
- **Historical tracking** with timestamp and user isolation

### 📊 Advanced Analytics
- **Setup performance analysis** (win rate, avg PnL, total PnL by setup)
- **Statistical breakdown** (trade count, win/loss ratio, discipline scoring)
- **Behavioral heatmaps** (emotion → performance correlation)
- **Portfolio allocation** (equities, options, forex breakdown)
- **Equity curve** rendering with profit/loss percentage

### 🔍 Market Scanner
- **Multi-timeframe scanning** (1m, 15m, 1h, 4h, 1D)
- **4 asset categories**: 🇮🇳 Indian stocks • 🇺🇸 US stocks • 🛢 Commodities • 💱 Forex/Crypto
- **Signal detection**: Breakouts, breakdowns, near-breakouts
- **Interactive charting** with lightweight-charts library
- **Moving averages** (MA20, MA50) + volume indicators

### 📰 Market Intelligence
- **News feed** aggregation (market news, analysis)
- **Economic calendar** (event impact, timing)
- **Sector analysis** (performance by sector)
- **Real-time quotes** (Yahoo Finance integration)

### 🤖 AI Assistant
- **Trade analysis** via Groq LLM (llama-3.3-70b)
- **Performance insights** based on logged trades
- **Setup recommendations** and risk assessment
- **Chat interface** for trader guidance

### 🏦 Multi-Broker Support
- **MetaTrader 5** (via MetaApi) - professional forex/stocks
- **Dhan** (Indian broker) - NSE/BSE equities & options
- **Live position syncing** and holdings tracking
- **Unified portfolio** view across brokers

### 🔐 Authentication & Security
- **JWT-based auth** (secure token storage)
- **User data isolation** (all queries filtered by user_id)
- **OAuth integration** for broker connections
- **Encrypted credential storage** (in Cloudflare KV)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│   React 19 + Vite Frontend              │
│   (Cloudflare Pages @ tradedaddy.pages.dev)
└──────────────────┬──────────────────────┘
                   │ HTTPS/REST
                   │ Bearer Token Auth
                   ▼
┌─────────────────────────────────────────┐
│   Hono API (Cloudflare Workers)         │
│   https://tradedaddy-api.monishpatil... │
└──────────┬────────────────┬────────────┬┘
           │                │            │
      ┌────▼─────┐   ┌──────▼────┐  ┌──▼──────┐
      │ D1 DB    │   │ R2 Store  │  │ KV Cache│
      │(SQLite)  │   │ (Images)  │  │(Tokens) │
      └──────────┘   └───────────┘  └─────────┘
           │
    External APIs (Groq, Yahoo, MetaApi, Dhan)
```

✅ **Low latency** (~50ms globally)  
✅ **Auto-scaling** serverless  
✅ **Zero deployment time** with Cloudflare Workers  
✅ **Data isolation** per user (security-first)

**[→ Full Architecture Docs](ARCHITECTURE.md)** | **[→ Visual Diagrams](ARCHITECTURE_DIAGRAMS.md)** | **[→ Quick Reference](QUICK_REFERENCE.md)**

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ 
- **npm** or **yarn**
- Cloudflare account (for deployment)

### Installation

```bash
# Clone repository
git clone https://github.com/Monishhyperbolic/Tradedaddy.git
cd Tradedaddy

# Install frontend dependencies
cd TradeDaddy
npm install

# Install backend dependencies
cd ../server
npm install
```

### Local Development

#### Frontend (Vite dev server)
```bash
cd TradeDaddy
npm run dev
# Opens at http://localhost:5173
```

#### Backend (Cloudflare Workers local)
```bash
cd server
wrangler dev
# API runs at http://localhost:8787
```

**Update API base URL in `TradeDaddy/src/utils/api.js`:**
```javascript
const BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8787'
  : 'https://tradedaddy-api.monishpatil.workers.dev'
```

### Environment Variables

**Backend** (`server/.env.local`):
```env
# Cloudflare D1 Database (auto-configured via wrangler.toml)
# No manual setup needed

# External APIs (optional for local dev)
GROQ_API_KEY=your_groq_key          # For AI chat
METAAPI_TOKEN=your_metaapi_token    # For MT5 linking
DHAN_API_KEY=your_dhan_key          # For Dhan linking
```

**Frontend** (`TradeDaddy/.env.local`):
```env
VITE_API_BASE=http://localhost:8787  # During dev
```

---

## 📚 API Documentation

### Authentication
```bash
# Sign up
curl -X POST https://tradedaddy-api.monishpatil.workers.dev/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"***","name":"John"}'
# Response: { token: "eyJhbG...", user: {...} }

# Login
curl -X POST https://tradedaddy-api.monishpatil.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"***"}'
```

### Trades CRUD
```bash
# List all trades
curl https://tradedaddy-api.monishpatil.workers.dev/api/trades \
  -H "Authorization: Bearer $TOKEN"

# Create trade
curl -X POST https://tradedaddy-api.monishpatil.workers.dev/api/trades \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol":"RELIANCE.NS",
    "type":"LONG",
    "entry":2850.50,
    "qty":10,
    "emotion":"😌",
    "setup":"Breakout+MA"
  }'

# Update trade
curl -X PUT https://tradedaddy-api.monishpatil.workers.dev/api/trades/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"exit":2900.00,"pnl":495.00}'

# Delete trade
curl -X DELETE https://tradedaddy-api.monishpatil.workers.dev/api/trades/{id} \
  -H "Authorization: Bearer $TOKEN"
```

### Market Data
```bash
# Get chart data (OHLC)
curl "https://tradedaddy-api.monishpatil.workers.dev/api/chart/RELIANCE.NS?range=3mo&interval=1d" \
  -H "Authorization: Bearer $TOKEN"

# Get real-time quote
curl "https://tradedaddy-api.monishpatil.workers.dev/api/quote/RELIANCE.NS" \
  -H "Authorization: Bearer $TOKEN"

# Scan for breakouts
curl "https://tradedaddy-api.monishpatil.workers.dev/api/scanner?category=indian&lookback=20" \
  -H "Authorization: Bearer $TOKEN"
```

### AI & Media
```bash
# Chat with AI
curl -X POST https://tradedaddy-api.monishpatil.workers.dev/api/ai \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages":[{"role":"user","content":"Analyze my RELIANCE trades"}],
    "system":"You are a trading coach analyzing trades..."
  }'

# Upload trade image
curl -X POST https://tradedaddy-api.monishpatil.workers.dev/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@screenshot.png"
```

**[→ Complete API Reference](QUICK_REFERENCE.md#-quick-deploy)**

---

## 📦 Tech Stack

### Frontend
| Component | Tech | Version |
|-----------|------|---------|
| Framework | React | 19.2.0 |
| Router | React Router DOM | 7.12.0 |
| Build | Vite | 7.2.4 |
| Charts | Lightweight Charts | 5.1.0 |
| Animations | GSAP + Motion | 3.14.2 + 12.24.7 |
| 3D Graphics | Three.js | 0.182.0 |
| Styling | CSS-in-JS (inline) | — |

### Backend
| Component | Tech | Purpose |
|-----------|------|---------|
| Framework | Hono | Lightweight HTTP server |
| Runtime | Cloudflare Workers | Serverless execution |
| Database | Cloudflare D1 | SQLite on the edge |
| Storage | Cloudflare R2 | Object storage (images) |
| Cache | Cloudflare KV | Key-value cache |
| LLM | Groq API | AI chat (llama-3.3-70b) |

### Infrastructure
- **Frontend Hosting**: Cloudflare Pages (static, auto-deployed)
- **Backend Hosting**: Cloudflare Workers (serverless, global)
- **Database**: Cloudflare D1 (edge SQL)
- **CDN**: Cloudflare (automatic)

---

## 🌐 Deployment

### Current Production URL
```
🔗 https://tradedaddy.monishpatil.workers.dev/
```

### Deploy Frontend
```bash
cd TradeDaddy
npm run build

# Git push automatically triggers Cloudflare Pages deployment
git push origin main
```

### Deploy Backend
```bash
cd server
wrangler deploy

# Or with environment:
wrangler deploy --env production
```

### Deploy Database
```bash
# Create/migrate schema
wrangler d1 execute tradedaddy-db --remote < schema.sql

# Seed watchlist
wrangler d1 execute tradedaddy-db --remote < seed.sql
```

### CI/CD Pipeline
- **GitHub Actions** validates frontend build & backend routes
- **Cloudflare Pages** auto-deploys on main branch push
- **Wrangler CLI** manages Worker deployments
- **Zero-downtime deployments** with automatic rollback support

---

## 📁 Project Structure

```
tradedaddy/
├── TradeDaddy/                      # Frontend (React + Vite)
│   ├── src/
│   │   ├── Pages/                   # Page components
│   │   │   ├── Dashboard.jsx        # Main trading interface
│   │   │   ├── Analytics.jsx        # Performance analytics
│   │   │   ├── Scanner.jsx          # Market scanner
│   │   │   ├── Auth.jsx             # Login/signup
│   │   │   ├── News.jsx             # News feed
│   │   │   └── ...
│   │   ├── components/              # Reusable UI components
│   │   │   ├── navbar/              # Navigation
│   │   │   ├── profilecard/         # User profile
│   │   │   └── features/            # Feature components
│   │   ├── utils/
│   │   │   └── api.js               # ⭐ API client (all endpoints)
│   │   ├── App.jsx                  # Router setup
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── server/                          # Backend (Hono + Cloudflare)
│   ├── src/
│   │   └── index.js                 # ⭐ All API routes
│   ├── schema.sql                   # Database schema
│   ├── seed.sql                     # Watchlist seeds
│   ├── package.json
│   ├── wrangler.toml                # ⭐ Cloudflare config
│   └── requirements.txt             # Python deps (if needed)
│
├── ARCHITECTURE.md                  # Full architecture doc
├── ARCHITECTURE_DIAGRAMS.md         # Visual diagrams
├── QUICK_REFERENCE.md               # Developer cheat sheet
├── README.md                         # This file
└── package.json                     # Monorepo root
```

---

## 🔒 Security & Best Practices

### Authentication
✅ JWT tokens + Bearer header  
✅ Tokens stored in localStorage (frontend only)  
✅ 1-hour token expiration  
✅ Auto-refresh on 401 response  

### Data Protection
✅ User data isolation (All queries filtered by `user_id` from JWT)  
✅ CORS validation (origin whitelisting in production)  
✅ Input validation (all endpoints sanitize inputs)  
✅ Encrypted broker credentials (stored in KV)  

### API Security
✅ HTTPS-only communication  
✅ Rate limiting on AI calls (3 req/min)  
✅ File upload validation (MIME type + size)  
✅ SQL parameterization (prevent injection)  

---

## 🐛 Troubleshooting

### Backend not responding
```bash
# Check local dev server
wrangler dev
# Verify API base URL in frontend config

# Check production logs
wrangler tail
```

### Database errors
```bash
# Verify schema
wrangler d1 execute tradedaddy-db --remote ".schema trades"

# Check user isolation
wrangler d1 execute tradedaddy-db --remote \
  "SELECT COUNT(*) FROM trades WHERE user_id = 'user_123';"
```

### Image uploads fail
```bash
# Check R2 bucket permissions
wrangler r2 bucket list

# Verify file size (<5MB)
# Check MIME type is image/*
```

### AI chat rate limited
```bash
# Check KV cache hit rate
wrangler kv:key list --binding=CACHE

# Wait 60 seconds before retry
# Check Groq quota in dashboard
```

---

## 📞 Support & Community

- **Bug Reports**: [GitHub Issues](https://github.com/Monishhyperbolic/Tradedaddy/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/Monishhyperbolic/Tradedaddy/discussions)
- **Architecture Questions**: See [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/your-feature`)
3. **Commit** your changes (`git commit -m 'Add your feature'`)
4. **Push** to the branch (`git push origin feature/your-feature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow `.eslintrc.js` rules for code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure no console errors in browser DevTools

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Cloudflare** for Workers, D1, R2, KV, and Pages infrastructure
- **Groq** for the powerful llama-3.3-70b model
- **MetaApi** for MT5 integration
- **Yahoo Finance** for market data
- **React & Vite** communities for excellent tooling

---

## 📊 Project Status

| Component | Status | Notes |
|-----------|--------|-------|
| Trading Journal | ✅ Production | Full CRUD, image uploads |
| Analytics | ✅ Production | Setup analysis, equity curves |
| Market Scanner | ✅ Production | Multi-timeframe, 4 categories |
| AI Chat | ✅ Production | Groq llama-3.3-70b |
| MT5 Integration | ✅ Production | Via MetaApi |
| Dhan Integration | ✅ Production | Indian broker support |
| Economic Calendar | ✅ Testing | Component ready |
| News Feed | ✅ Testing | Aggregation in progress |
| Mobile App | 🔄 Planned | React Native support |
| Backtesting | 🔄 Planned | Integration with strategy analyzers |

---

## 🚀 Performance

- **API Response Time**: ~50ms (global with Cloudflare Workers)
- **Frontend Load**: ~2s (Vite optimized + CDN)
- **Database Queries**: <100ms (D1 indexed queries)
- **Image Serving**: ~500ms first request, instant cached (R2 CDN)

---

## 📈 Roadmap

- [ ] Real-time WebSocket updates (trades, positions)
- [ ] Advanced backtesting engine
- [ ] Automated trade alerts
- [ ] Performance heatmaps by market condition
- [ ] Risk management tools (drawdown limits, Kelly criterion)
- [ ] Integration with TradingView and other charting platforms
- [ ] Mobile application (React Native)
- [ ] Historical data export (CSV, Excel)
- [ ] Multi-language support
- [ ] Role-based access control (teams, mentors)

---

## 👨‍💻 Author

**Monish Patil**  
🔗 [GitHub](https://github.com/Monishhyperbolic) | 🔗 [Portfolio](https://monishpatil.com)

---

<div align="center">

### Built with ❤️ using Cloudflare Workers + React

⭐ **If you find this useful, please consider starring the repository!** ⭐

---

**Happy trading! 📈**

</div>
