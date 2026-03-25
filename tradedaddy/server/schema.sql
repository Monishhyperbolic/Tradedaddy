-- TradeDaddy D1 Schema
-- Run: wrangler d1 execute tradedaddy-db --file=./schema.sql

CREATE TABLE IF NOT EXISTS trades (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL DEFAULT 'default',
  symbol      TEXT NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('LONG','SHORT')),
  entry       REAL NOT NULL,
  exit        REAL,
  qty         REAL NOT NULL,
  pnl         REAL DEFAULT 0,
  date        TEXT NOT NULL,
  emotion     TEXT DEFAULT '😐',
  discipline  INTEGER DEFAULT 70,
  setup       TEXT DEFAULT '',
  notes       TEXT DEFAULT '',
  image_url   TEXT DEFAULT '',
  tags        TEXT DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS holdings (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL DEFAULT 'default',
  symbol      TEXT NOT NULL,
  qty         REAL NOT NULL,
  avg_price   REAL NOT NULL,
  sector      TEXT DEFAULT '',
  exchange    TEXT DEFAULT 'NSE',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watchlist (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL DEFAULT 'default',
  symbol      TEXT NOT NULL,
  added_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default watchlist (NIFTY 50 + key stocks)
INSERT OR IGNORE INTO watchlist (id, symbol) VALUES
  ('w1',  'RELIANCE.NS'),
  ('w2',  'TCS.NS'),
  ('w3',  'HDFCBANK.NS'),
  ('w4',  'INFY.NS'),
  ('w5',  'ICICIBANK.NS'),
  ('w6',  'HINDUNILVR.NS'),
  ('w7',  'ITC.NS'),
  ('w8',  'SBIN.NS'),
  ('w9',  'BHARTIARTL.NS'),
  ('w10', 'BAJFINANCE.NS'),
  ('w11', 'KOTAKBANK.NS'),
  ('w12', 'LT.NS'),
  ('w13', 'AXISBANK.NS'),
  ('w14', 'ASIANPAINT.NS'),
  ('w15', 'MARUTI.NS'),
  ('w16', 'SUNPHARMA.NS'),
  ('w17', 'TITAN.NS'),
  ('w18', 'WIPRO.NS'),
  ('w19', 'NESTLEIND.NS'),
  ('w20', 'ULTRACEMCO.NS'),
  ('w21', 'ADANIENT.NS'),
  ('w22', 'ADANIPORTS.NS'),
  ('w23', 'POWERGRID.NS'),
  ('w24', 'NTPC.NS'),
  ('w25', 'ONGC.NS'),
  ('w26', 'GC=F'),
  ('w27', 'EURUSD=X'),
  ('w28', 'GBP=X');

-- Sample seeded trades
INSERT OR IGNORE INTO trades (id, symbol, type, entry, exit, qty, pnl, date, emotion, discipline, setup, notes) VALUES
  ('t1', 'RELIANCE', 'LONG',  2847, 2921, 10, 740,  '2025-06-25', '😊', 92, 'Breakout', 'Clean breakout above 2900 resistance'),
  ('t2', 'NIFTY 50', 'SHORT', 24180,24050,1,  1300, '2025-06-24', '😤', 78, 'Divergence','Bearish divergence on 15m'),
  ('t3', 'XAUUSD',   'LONG',  2318, 2301, 1, -170, '2025-06-24', '😰', 61, 'Fakeout',  'Entered on fake breakout, stopped out'),
  ('t4', 'TCS',      'LONG',  3920, 4011, 5,  455, '2025-06-23', '😊', 88, 'Pullback', 'Classic pullback to 20 EMA'),
  ('t5', 'HDFCBANK', 'SHORT', 1672, 1645, 20, 540, '2025-06-23', '😐', 83, 'Resistance','Strong supply at 1680 level');
