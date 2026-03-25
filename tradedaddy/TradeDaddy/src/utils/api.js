/**
 * TradeDaddy API Client
 * Worker URL is hardcoded — no .env file needed
 * To update: change API_BASE below
 */

const API_BASE = 'https://tradedaddy-api.monishpatil.workers.dev'

/* ── Token storage (memory + localStorage for persistence) ── */
let _token = null

export const auth = {
  getToken: () => {
    if (_token) return _token
    _token = localStorage.getItem('td_token')
    return _token
  },
  setToken: (token) => {
    _token = token
    if (token) localStorage.setItem('td_token', token)
    else localStorage.removeItem('td_token')
  },
  getUser: () => {
    try {
      const raw = localStorage.getItem('td_user')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  },
  setUser: (user) => {
    if (user) localStorage.setItem('td_user', JSON.stringify(user))
    else localStorage.removeItem('td_user')
  },
  logout: () => {
    _token = null
    localStorage.removeItem('td_token')
    localStorage.removeItem('td_user')
  },
  isLoggedIn: () => !!auth.getToken(),
}

/* ── Core fetch wrapper ── */
const req = async (path, options = {}) => {
  const token = auth.getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    if (res.status === 401) { auth.logout(); window.location.href = '/auth' }
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  /* ── Auth ── */
  signup: (email, password, name) =>
    req('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email, password) =>
    req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => req('/api/auth/me'),

  /* ── Health ── */
  health: () => req('/api/health'),

  /* ── Trades ── */
  getTrades:   ()       => req('/api/trades'),
  createTrade: (trade)  => req('/api/trades', { method: 'POST', body: JSON.stringify(trade) }),
  updateTrade: (id, t)  => req(`/api/trades/${id}`, { method: 'PUT', body: JSON.stringify(t) }),
  deleteTrade: (id)     => req(`/api/trades/${id}`, { method: 'DELETE' }),

  /* ── Holdings ── */
  getHoldings:   ()    => req('/api/holdings'),
  createHolding: (h)   => req('/api/holdings', { method: 'POST', body: JSON.stringify(h) }),
  deleteHolding: (id)  => req(`/api/holdings/${id}`, { method: 'DELETE' }),

  /* ── Image Upload ── */
  uploadImage: async (file) => {
    const token = auth.getToken()
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    })
    if (!res.ok) throw new Error('Upload failed')
    return res.json()
  },

  /* ── Chart Data ── */
  getChart: (symbol, range = '3mo', interval = '1d') =>
    req(`/api/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`),

  /* ── Scanner ── */
  scan: (lookback = 20, minVolRatio = 1.3) =>
    req(`/api/scanner?lookback=${lookback}&minVolRatio=${minVolRatio}`),

  /* ── Watchlist ── */
  getWatchlist:        ()       => req('/api/watchlist'),
  addToWatchlist:      (symbol) => req('/api/watchlist', { method: 'POST', body: JSON.stringify({ symbol }) }),
  removeFromWatchlist: (id)     => req(`/api/watchlist/${id}`, { method: 'DELETE' }),
}