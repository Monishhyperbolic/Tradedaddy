-- TradeDaddy D1 Schema v2
-- Run: wrangler d1 execute tradedaddy-db --file=./schema.sql --remote

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trades (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  symbol       TEXT NOT NULL,
  type         TEXT NOT NULL CHECK(type IN ('LONG','SHORT')),
  entry        REAL NOT NULL,
  exit         REAL,
  qty          REAL NOT NULL,
  pnl          REAL DEFAULT 0,
  date         TEXT NOT NULL,
  emotion      TEXT DEFAULT '😐',
  discipline   INTEGER DEFAULT 70,
  setup        TEXT DEFAULT '',
  notes        TEXT DEFAULT '',
  image_url    TEXT DEFAULT '',
  tags         TEXT DEFAULT '[]',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS holdings (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  symbol       TEXT NOT NULL,
  qty          REAL NOT NULL,
  avg_price    REAL NOT NULL,
  sector       TEXT DEFAULT '',
  exchange     TEXT DEFAULT 'NSE',
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watchlist (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL DEFAULT 'default',
  symbol       TEXT NOT NULL,
  added_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO watchlist (id, user_id, symbol) VALUES
  ('w1','default','RELIANCE.NS'),('w2','default','TCS.NS'),('w3','default','HDFCBANK.NS'),
  ('w4','default','INFY.NS'),('w5','default','ICICIBANK.NS'),('w6','default','ITC.NS'),
  ('w7','default','SBIN.NS'),('w8','default','BHARTIARTL.NS'),('w9','default','BAJFINANCE.NS'),
  ('w10','default','KOTAKBANK.NS'),('w11','default','LT.NS'),('w12','default','AXISBANK.NS'),
  ('w13','default','ASIANPAINT.NS'),('w14','default','MARUTI.NS'),('w15','default','SUNPHARMA.NS'),
  ('w16','default','TITAN.NS'),('w17','default','WIPRO.NS'),('w18','default','ADANIENT.NS'),
  ('w19','default','NTPC.NS'),('w20','default','POWERGRID.NS'),
  ('w21','default','GC=F'),('w22','default','EURUSD=X'),('w23','default','GBP=X'),('w24','default','BTC-USD');