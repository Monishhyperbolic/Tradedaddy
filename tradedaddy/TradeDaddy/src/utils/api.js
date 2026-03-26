/**
 * TradeDaddy API Client v4
 * Named exports to avoid bundler tree-shaking issues
 */

const BASE = 'https://tradedaddy-api.monishpatil.workers.dev'
let _token = null

/* ── Auth helpers ── */
export const getStoredToken  = () => { if (_token) return _token; return (_token = localStorage.getItem('td_token')) }
export const setStoredToken  = (t) => { _token = t; t ? localStorage.setItem('td_token', t) : localStorage.removeItem('td_token') }
export const getStoredUser   = () => { try { const r=localStorage.getItem('td_user'); return r?JSON.parse(r):null } catch { return null } }
export const setStoredUser   = (u) => { u ? localStorage.setItem('td_user', JSON.stringify(u)) : localStorage.removeItem('td_user') }
export const logoutUser      = () => { _token=null; localStorage.removeItem('td_token'); localStorage.removeItem('td_user') }
export const isLoggedIn      = () => !!getStoredToken()

/* ── Core fetch ── */
const req = async (path, opts = {}) => {
  const token = getStoredToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}), ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    if (res.status === 401) { logoutUser(); window.location.href = '/auth' }
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/* ── Auth ── */
export const signup  = (email, password, name) => req('/api/auth/signup', { method:'POST', body:JSON.stringify({email,password,name}) })
export const login   = (email, password)       => req('/api/auth/login',  { method:'POST', body:JSON.stringify({email,password}) })
export const getMe   = ()                      => req('/api/auth/me')

/* ── Trades ── */
export const getTrades    = ()      => req('/api/trades')
export const createTrade  = (t)     => req('/api/trades', { method:'POST', body:JSON.stringify(t) })
export const updateTrade  = (id, t) => req(`/api/trades/${id}`, { method:'PUT', body:JSON.stringify(t) })
export const deleteTrade  = (id)    => req(`/api/trades/${id}`, { method:'DELETE' })

/* ── Holdings ── */
export const getHoldings   = ()    => req('/api/holdings')
export const createHolding = (h)   => req('/api/holdings', { method:'POST', body:JSON.stringify(h) })
export const deleteHolding = (id)  => req(`/api/holdings/${id}`, { method:'DELETE' })
export const clearHoldings = ()    => req('/api/holdings', { method:'DELETE' })

/* ── Upload ── */
export const uploadImage = async (file) => {
  const token = getStoredToken()
  const fd = new FormData(); fd.append('file', file)
  const res = await fetch(`${BASE}/api/upload`, { method:'POST', headers: token?{Authorization:`Bearer ${token}`}:{}, body:fd })
  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}

/* ── Chart & Quote ── */
export const getChart = (symbol, range='3mo', interval='1d') => req(`/api/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`)
export const getQuote = (symbol) => req(`/api/quote/${encodeURIComponent(symbol)}`)

/* ── Scanner ── */
export const scan = (lookback=20, minVolRatio=1.2, category='indian', interval='1d') =>
  req(`/api/scanner?lookback=${lookback}&minVolRatio=${minVolRatio}&category=${category}&interval=${interval}`)

/* ── News ── */
export const getNews     = (category='markets') => req(`/api/news?category=${category}`)
export const analyzeNews = (headline, desc)     => req('/api/news/analyze', { method:'POST', body:JSON.stringify({headline,description:desc}) })

/* ── Economic Calendar ── */
export const getCalendar = () => req('/api/calendar')

/* ── Dhan ── */
export const connectDhan      = (clientId, accessToken) => req('/api/broker/dhan/connect', { method:'POST', body:JSON.stringify({clientId,accessToken}) })
export const getDhanHoldings  = ()    => req('/api/broker/dhan/holdings')
export const getDhanPositions = ()    => req('/api/broker/dhan/positions')
export const getDhanTrades    = ()    => req('/api/broker/dhan/tradebook')
export const getDhanStatus    = ()    => req('/api/broker/dhan/status')
export const disconnectDhan   = ()    => req('/api/broker/dhan/disconnect', { method:'DELETE' })

/* ── MT5 ── */
export const getMt5Positions = () => req('/api/broker/mt5/positions')
export const getMt5Status    = () => req('/api/broker/mt5/status')

/* ── Watchlist ── */
export const getWatchlist        = ()       => req('/api/watchlist')
export const addToWatchlist      = (symbol) => req('/api/watchlist', { method:'POST', body:JSON.stringify({symbol}) })
export const removeFromWatchlist = (id)     => req(`/api/watchlist/${id}`, { method:'DELETE' })


/* ── HuggingFace (proxied through Worker to avoid CORS) ── */
export const hfChat = async (prompt, userToken) => {
  const token = userToken || localStorage.getItem('hf_token') || ''
  const res = await fetch(`${BASE}/api/hf/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, token, model: 'mistralai/Mistral-7B-Instruct-v0.2' }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HF proxy error ${res.status}`)
  }
  const data = await res.json()
  if (data.loading) throw new Error(data.text) // re-throw loading message
  return data.text || 'No response generated.'
}

/* ── Legacy api object (backward compat) ── */
export const api = {
  signup, login, me: getMe,
  getTrades, createTrade, updateTrade, deleteTrade,
  getHoldings, createHolding, deleteHolding, clearHoldings,
  uploadImage, getChart, getQuote,
  scan, getNews, analyzeNews, getCalendar,
  connectDhan, getDhanHoldings, getDhanPositions, getDhanTrades, getDhanStatus, disconnectDhan,
  getMt5Positions, getMt5Status,
  getWatchlist, addToWatchlist, removeFromWatchlist,
  hfChat,
}

export const auth = {
  getToken: getStoredToken, setToken: setStoredToken,
  getUser:  getStoredUser,  setUser:  setStoredUser,
  logout:   logoutUser,     isLoggedIn,
}