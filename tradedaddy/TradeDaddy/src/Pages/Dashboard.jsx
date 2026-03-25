/**
 * Dashboard.jsx  —  TradeDaddy
 * All data persisted to Cloudflare D1 via the Worker API
 * Images uploaded to Cloudflare R2
 */

import { useState, useEffect, useRef } from 'react'
import { api } from '../utils/api'
import Scanner from './Scanner'

/* ── Design tokens ── */
const C = {
  bg:      '#09070f',
  surface: 'rgba(255,255,255,0.03)',
  border:  'rgba(255,255,255,0.07)',
  purple:  '#5227FF',
  green:   '#34C77B',
  red:     '#FF5C5C',
  amber:   '#F59E0B',
  text:    'rgba(255,255,255,0.85)',
  muted:   'rgba(255,255,255,0.4)',
  faint:   'rgba(255,255,255,0.07)',
}

/* ── Format helpers ── */
const fmt = (n) => n != null ? (n >= 0 ? `+₹${Math.abs(n).toLocaleString('en-IN')}` : `-₹${Math.abs(n).toLocaleString('en-IN')}`) : '—'
const pct = (n) => n != null ? (n >= 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`) : '—'

/* ── Nav items ── */
const NAV = [
  { icon: '▣',  label: 'Dashboard', id: 'dashboard' },
  { icon: '📋', label: 'Journal',   id: 'journal' },
  { icon: '🔍', label: 'Scanner',   id: 'scanner' },
  { icon: '📈', label: 'Holdings',  id: 'holdings' },
  { icon: '🤖', label: 'AI Chat',   id: 'chat' },
  { icon: '⚙',  label: 'Settings',  id: 'settings' },
]

/* ── EQUITY CHART (static sparkline — replace with real data) ── */
const CURVE = [10000,10240,10180,10450,10390,10620,10580,10800,10750,11020,10940,11280,11180,11500,11420,11700,11650,11900,11840,12100]

function EquityChart() {
  const W = 560, H = 140, PAD = 20
  const min = Math.min(...CURVE), max = Math.max(...CURVE)
  const sx = (i) => PAD + (i / (CURVE.length - 1)) * (W - PAD * 2)
  const sy = (v) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2)
  const line = CURVE.map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(i)},${sy(v)}`).join(' ')
  const area = `${line} L${sx(CURVE.length-1)},${H} L${sx(0)},${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      <defs>
        <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={C.purple} stopOpacity="0.35" />
          <stop offset="100%" stopColor={C.purple} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#eq)" />
      <path d={line} fill="none" stroke={C.purple} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx(CURVE.length-1)} cy={sy(CURVE[CURVE.length-1])} r="5"  fill={C.purple} />
      <circle cx={sx(CURVE.length-1)} cy={sy(CURVE[CURVE.length-1])} r="10" fill={C.purple} fillOpacity="0.2" />
    </svg>
  )
}

/* ── DONUT CHART ── */
const ALLOC = [
  { label: 'Equities', value: 62, color: C.purple },
  { label: 'Options',  value: 18, color: '#9B59B6' },
  { label: 'Forex',    value: 12, color: '#C084FC' },
  { label: 'Cash',     value:  8, color: 'rgba(255,255,255,0.15)' },
]
function DonutChart({ total = '₹12.1L' }) {
  const R = 52, cx = 70, cy = 70, stroke = 18
  const circ = 2 * Math.PI * R
  let offset = 0
  return (
    <svg viewBox="0 0 140 140" style={{ width: 140, height: 140, flexShrink: 0 }}>
      {ALLOC.map((s) => {
        const dash = (s.value / 100) * circ
        const el = (
          <circle key={s.label} cx={cx} cy={cy} r={R} fill="none"
            stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )
        offset += dash
        return el
      })}
      <text x={cx} y={cy - 6}  textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill={C.muted} fontSize="9">Portfolio</text>
    </svg>
  )
}

/* ── STAT CARD ── */
function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 22px' }}>
      <p style={{ margin: '0 0 6px', fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: color || '#fff', letterSpacing: '-0.02em' }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{sub}</p>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   ADD/EDIT TRADE MODAL (with image upload)
───────────────────────────────────────────────────────────────── */
function TradeModal({ initial, onSave, onClose }) {
  const EMPTY = { symbol: '', type: 'LONG', entry: '', exit: '', qty: '', pnl: '', date: new Date().toISOString().slice(0,10), emotion: '😊', discipline: 80, setup: '', notes: '', image_url: '' }
  const [form, setForm]     = useState(initial || EMPTY)
  const [imgFile, setImgFile]  = useState(null)
  const [imgPreview, setImgPreview] = useState(initial?.image_url || '')
  const [uploading, setUploading]  = useState(false)
  const [saving, setSaving]        = useState(false)
  const fileRef = useRef()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImgFile(file)
    setImgPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!form.symbol) return
    setSaving(true)
    try {
      let image_url = form.image_url
      if (imgFile) {
        setUploading(true)
        const uploaded = await api.uploadImage(imgFile)
        image_url = uploaded.url
        setUploading(false)
      }
      // Auto-calc PnL if not set
      let pnl = parseFloat(form.pnl)
      if (!pnl && form.entry && form.exit && form.qty) {
        const diff = form.type === 'LONG'
          ? (parseFloat(form.exit) - parseFloat(form.entry))
          : (parseFloat(form.entry) - parseFloat(form.exit))
        pnl = +(diff * parseFloat(form.qty)).toFixed(2)
      }
      await onSave({ ...form, entry: +form.entry, exit: +form.exit || null, qty: +form.qty, pnl, image_url })
    } finally {
      setSaving(false)
    }
  }

  const Input = ({ label, name, type = 'text', ...props }) => (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      <input
        name={name} type={type} value={form[name] ?? ''} onChange={e => set(name, e.target.value)}
        style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        onFocus={e => e.target.style.borderColor = C.purple}
        onBlur={e => e.target.style.borderColor = C.border}
        {...props}
      />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#0d0b16', border: `1px solid rgba(82,39,255,0.3)`, borderRadius: 20, padding: '28px 30px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{initial ? 'Edit Trade' : 'Log New Trade'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Symbol + Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
            <Input label="Symbol" name="symbol" placeholder="RELIANCE, XAUUSD…" />
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['LONG','SHORT'].map(t => (
                  <button key={t} onClick={() => set('type', t)} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: form.type === t ? (t === 'LONG' ? 'rgba(52,199,123,0.2)' : 'rgba(255,92,92,0.2)') : 'rgba(255,255,255,0.05)', color: form.type === t ? (t === 'LONG' ? C.green : C.red) : C.muted }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Entry / Exit / Qty */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Input label="Entry ₹" name="entry" type="number" placeholder="0.00" />
            <Input label="Exit ₹"  name="exit"  type="number" placeholder="0.00" />
            <Input label="Qty"     name="qty"   type="number" placeholder="1" />
          </div>

          {/* Date + Setup */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Date" name="date" type="date" />
            <Input label="Setup" name="setup" placeholder="Breakout, Pullback…" />
          </div>

          {/* Emotion + Discipline */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Emotion</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['😊','😐','😤','😰','🤑'].map(e => (
                  <button key={e} onClick={() => set('emotion', e)} style={{ flex: 1, padding: '8px 0', border: `1px solid ${form.emotion === e ? C.purple : C.border}`, borderRadius: 8, background: form.emotion === e ? 'rgba(82,39,255,0.2)' : 'rgba(255,255,255,0.04)', fontSize: 16, cursor: 'pointer' }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Discipline: {form.discipline}/100</label>
              <input type="range" min="0" max="100" value={form.discipline} onChange={e => set('discipline', +e.target.value)}
                style={{ width: '100%', accentColor: C.purple, marginTop: 6 }} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</label>
            <textarea
              value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="What happened? Why did you enter? What would you do differently?"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = C.purple}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>

          {/* IMAGE UPLOAD */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Chart Screenshot</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />

            {imgPreview ? (
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                <img src={imgPreview} alt="chart" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                <button
                  onClick={() => { setImgFile(null); setImgPreview(''); set('image_url', '') }}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 6, color: '#fff', padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
                >
                  ✕ Remove
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 6, color: '#fff', padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: '24px 0', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.purple}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>📸</div>
                <div style={{ fontSize: 13, color: C.muted }}>Click to upload chart screenshot</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>PNG, JPG up to 5MB · Stored in Cloudflare R2</div>
              </div>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || uploading || !form.symbol}
            style={{
              marginTop: 4, padding: '13px 0', border: 'none', borderRadius: 12,
              background: !form.symbol ? 'rgba(82,39,255,0.3)' : C.purple,
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: !form.symbol ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
          >
            {uploading ? '📤 Uploading image…' : saving ? 'Saving…' : initial ? 'Save Changes' : '+ Log Trade'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   DASHBOARD HOME
───────────────────────────────────────────────────────────────── */
function DashboardHome({ trades, holdings }) {
  const totalPnL     = trades.reduce((s, t) => s + (t.pnl || 0), 0)
  const wins         = trades.filter(t => t.pnl > 0).length
  const winRate      = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0
  const avgDiscipline = trades.length > 0 ? Math.round(trades.reduce((s, t) => s + (t.discipline || 70), 0) / trades.length) : 0
  const totalValue   = holdings.reduce((s, h) => s + (h.qty * h.avg_price), 0)

  const emotions = trades.slice(0, 30).map(t => t.emotion || '😐')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Good morning, Monish 👋</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>{new Date().toDateString()} · NSE Pre-open</p>
        </div>
        <div style={{ background: 'rgba(82,39,255,0.15)', border: '1px solid rgba(82,39,255,0.3)', borderRadius: 12, padding: '10px 16px', fontSize: 13 }}>
          🟢 Cloudflare D1 Connected
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Portfolio Value"  value={totalValue > 0 ? `₹${(totalValue/100000).toFixed(1)}L` : '—'} sub={`${holdings.length} positions`} />
        <StatCard label="Total PnL"        value={fmt(totalPnL)} sub={`${trades.length} trades`} color={totalPnL >= 0 ? C.green : C.red} />
        <StatCard label="Win Rate"         value={`${winRate}%`} sub="All trades" color={winRate >= 60 ? C.green : C.amber} />
        <StatCard label="Avg Discipline"   value={`${avgDiscipline}/100`} sub="Journal score" color="#C084FC" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 24 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.muted }}>Equity Curve</h3>
            <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>+21.0% all-time</span>
          </div>
          <EquityChart />
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: C.muted }}>Allocation</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <DonutChart />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ALLOC.map(a => (
                <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: a.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C.muted }}>{a.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginLeft: 'auto', paddingLeft: 8 }}>{a.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent trades preview */}
      {trades.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: C.muted }}>Recent Trades</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {trades.slice(0, 5).map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>{t.emotion}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{t.symbol}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: t.type === 'LONG' ? 'rgba(52,199,123,0.15)' : 'rgba(255,92,92,0.15)', color: t.type === 'LONG' ? C.green : C.red }}>{t.type}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{t.setup}</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: t.pnl >= 0 ? C.green : C.red }}>{fmt(t.pnl)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emotion calendar */}
      {emotions.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: C.muted }}>Emotional State Tracker</h3>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>One emoji per trade logged</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {emotions.map((e, i) => (
              <div key={i} style={{ width: 36, height: 36, borderRadius: 10, fontSize: 18, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.faint}` }}>
                {e}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   JOURNAL PAGE (with image upload)
───────────────────────────────────────────────────────────────── */
function JournalPage({ trades, onAdd, onDelete }) {
  const [showModal, setShowModal] = useState(false)
  const [editTrade, setEditTrade] = useState(null)
  const [filter, setFilter]       = useState('ALL')
  const [search, setSearch]       = useState('')

  const filtered = trades.filter(t => {
    if (filter !== 'ALL' && t.type !== filter) return false
    if (search && !t.symbol.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>Trade Journal</h1>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
            {trades.length} trades logged · {trades.filter(t => t.pnl > 0).length} wins
          </p>
        </div>
        <button
          onClick={() => { setEditTrade(null); setShowModal(true) }}
          style={{ padding: '10px 22px', background: C.purple, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + Log Trade
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search symbol…"
          style={{ padding: '9px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', width: 180 }}
          onFocus={e => e.target.style.borderColor = C.purple}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        {['ALL','LONG','SHORT'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 16px', border: 'none', borderRadius: 10, fontFamily: 'inherit',
            background: filter === f ? C.purple : C.surface, color: filter === f ? '#fff' : C.muted,
            fontSize: 13, fontWeight: filter === f ? 700 : 400, cursor: 'pointer',
          }}>{f}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted, fontSize: 14 }}>
          No trades yet. Click "Log Trade" to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(t => (
            <TradeCard key={t.id} trade={t}
              onEdit={() => { setEditTrade(t); setShowModal(true) }}
              onDelete={() => onDelete(t.id)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <TradeModal
          initial={editTrade}
          onClose={() => { setShowModal(false); setEditTrade(null) }}
          onSave={async (data) => {
            await onAdd(data, editTrade?.id)
            setShowModal(false)
            setEditTrade(null)
          }}
        />
      )}
    </div>
  )
}

/* ── Trade Card (in journal) ── */
function TradeCard({ trade: t, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', transition: 'border-color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(82,39,255,0.3)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>{t.emotion}</span>
          <div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{t.symbol}</span>
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: t.type === 'LONG' ? 'rgba(52,199,123,0.15)' : 'rgba(255,92,92,0.15)', color: t.type === 'LONG' ? C.green : C.red }}>{t.type}</span>
            {t.setup && <span style={{ marginLeft: 8, fontSize: 12, color: C.muted }}>#{t.setup}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontSize: 12, color: C.muted }}>{t.date?.slice(0,10)}</span>
          {t.image_url && <span style={{ fontSize: 11, color: '#C084FC' }}>📸</span>}
          <span style={{ fontWeight: 800, fontSize: 15, color: (t.pnl || 0) >= 0 ? C.green : C.red }}>{fmt(t.pnl)}</span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 1 }}>Discipline</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.discipline >= 80 ? C.green : t.discipline >= 60 ? C.amber : C.red }}>{t.discipline}/100</div>
          </div>
          <span style={{ color: C.muted, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.faint}`, padding: '16px 20px' }}>
          {/* Chart image */}
          {t.image_url && (
            <div style={{ marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
              <img src={t.image_url} alt="chart screenshot" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
            {[['Entry', t.entry ? `₹${(+t.entry).toLocaleString('en-IN')}` : '—'], ['Exit', t.exit ? `₹${(+t.exit).toLocaleString('en-IN')}` : 'Open'], ['Qty', t.qty]].map(([l,v]) => (
              <div key={l}>
                <p style={{ margin: '0 0 2px', fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{v}</p>
              </div>
            ))}
          </div>

          {t.notes && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(82,39,255,0.08)', borderRadius: 10, border: `1px solid rgba(82,39,255,0.15)`, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
              {t.notes}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onEdit} style={{ padding: '7px 16px', background: 'rgba(82,39,255,0.15)', border: `1px solid rgba(82,39,255,0.3)`, borderRadius: 8, color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
            <button onClick={onDelete} style={{ padding: '7px 16px', background: 'rgba(255,92,92,0.1)', border: '1px solid rgba(255,92,92,0.2)', borderRadius: 8, color: C.red, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   HOLDINGS PAGE
───────────────────────────────────────────────────────────────── */
function HoldingsPage({ holdings, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ symbol: '', qty: '', avg_price: '', sector: '', exchange: 'NSE' })
  const [saving, setSaving] = useState(false)

  const totalValue = holdings.reduce((s, h) => s + (h.qty * h.avg_price), 0)

  const handleAdd = async () => {
    if (!form.symbol || !form.qty || !form.avg_price) return
    setSaving(true)
    try {
      await api.createHolding({ ...form, qty: +form.qty, avg_price: +form.avg_price })
      setForm({ symbol: '', qty: '', avg_price: '', sector: '', exchange: 'NSE' })
      setShowAdd(false)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    await api.deleteHolding(id)
    onRefresh()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>Holdings</h1>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>{holdings.length} positions · Total cost ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '10px 22px', background: C.purple, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add Holding
        </button>
      </div>

      {showAdd && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 12 }}>
            {[['Symbol','symbol','RELIANCE'], ['Qty','qty','10'], ['Avg Price','avg_price','2800'], ['Sector','sector','Energy']].map(([label, key, ph]) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={ph}
                  style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.purple}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={handleAdd} disabled={saving} style={{ width: '100%', padding: '9px 0', background: C.purple, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? '…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {holdings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>No holdings yet.</div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Symbol','Exchange','Sector','Qty','Avg Price',''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holdings.map(h => (
                <tr key={h.id} style={{ borderBottom: `1px solid ${C.faint}` }}>
                  <td style={{ padding: '13px 16px', fontWeight: 700, fontSize: 14 }}>{h.symbol}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: C.muted }}>{h.exchange}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: C.muted }}>{h.sector || '—'}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13 }}>{h.qty}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600 }}>₹{(+h.avg_price).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <button onClick={() => handleDelete(h.id)} style={{ padding: '5px 12px', background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.15)', borderRadius: 7, color: C.red, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   AI CHAT (portfolio-aware, powered by Anthropic API)
───────────────────────────────────────────────────────────────── */
function ChatPage({ trades, holdings }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi Monish! I have full context on your portfolio, trade history, and journal. Ask me anything — from "Why did I lose money this week?" to "How does the RBI rate decision affect my bank stocks?"' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef()

  const SUGGESTIONS = [
    'Summarize my trading performance this week',
    'What patterns do you see in my losing trades?',
    'How does the RBI policy affect my HDFC Bank?',
    'What's my most consistent setup?',
  ]

  const send = async (msg) => {
    const text = msg || input.trim()
    if (!text) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setLoading(true)

    try {
      const context = `
User portfolio data:
Holdings: ${JSON.stringify(holdings)}
Recent trades (last 20): ${JSON.stringify(trades.slice(0, 20))}
Stats: ${trades.length} total trades, ${trades.filter(t => t.pnl > 0).length} wins, avg discipline ${trades.length > 0 ? Math.round(trades.reduce((s,t)=>s+(t.discipline||70),0)/trades.length) : 70}/100
Total PnL: ₹${trades.reduce((s,t)=>s+(t.pnl||0),0).toLocaleString('en-IN')}
      `.trim()

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are TradeDaddy's AI trading assistant for an Indian equity and forex trader. You have access to their complete live portfolio and trade journal. Always reference specific trades, holdings, or patterns from the data when relevant. Be concise, direct, and actionable. Use ₹ for INR. Portfolio context: ${context}`,
          messages: messages.concat([{ role: 'user', content: text }]).map(m => ({ role: m.role, content: m.text })),
        }),
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text || 'Something went wrong.'
      setMessages(prev => [...prev, { role: 'assistant', text: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${e.message}` }])
    } finally {
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>AI Chat</h1>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted }}>Powered by Claude — grounded in your live portfolio data.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => send(s)} style={{ padding: '7px 14px', border: `1px solid rgba(82,39,255,0.3)`, borderRadius: 999, background: 'rgba(82,39,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4, marginBottom: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '72%', padding: '12px 16px', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: m.role === 'user' ? 'rgba(82,39,255,0.3)' : C.surface, border: `1px solid ${m.role === 'user' ? 'rgba(82,39,255,0.4)' : C.border}`, fontSize: 14, lineHeight: 1.65, color: 'rgba(255,255,255,0.9)', whiteSpace: 'pre-wrap' }}>
              {m.role === 'assistant' && <span style={{ fontSize: 15, marginRight: 8 }}>🤖</span>}
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex' }}>
            <div style={{ padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: C.surface, border: `1px solid ${C.border}`, fontSize: 14, color: C.muted }}>🤖 Analysing your portfolio…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about your portfolio, setups, or market conditions…"
          style={{ flex: 1, padding: '13px 18px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          onFocus={e => e.target.style.borderColor = C.purple}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{ padding: '13px 22px', background: C.purple, border: 'none', borderRadius: 14, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: loading || !input.trim() ? 0.5 : 1 }}>↑</button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   ROOT DASHBOARD
───────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [page,     setPage]     = useState('dashboard')
  const [sidebar,  setSidebar]  = useState(true)
  const [trades,   setTrades]   = useState([])
  const [holdings, setHoldings] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [t, h] = await Promise.all([api.getTrades(), api.getHoldings()])
      setTrades(t)
      setHoldings(h)
      setError(null)
    } catch (e) {
      setError(`Could not reach API: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const handleAddTrade = async (data, existingId) => {
    if (existingId) {
      const updated = await api.updateTrade(existingId, data)
      setTrades(prev => prev.map(t => t.id === existingId ? updated : t))
    } else {
      const created = await api.createTrade(data)
      setTrades(prev => [created, ...prev])
    }
  }

  const handleDeleteTrade = async (id) => {
    await api.deleteTrade(id)
    setTrades(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: "'Space Grotesk', sans-serif", color: '#fff' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{ width: sidebar ? 220 : 64, flexShrink: 0, background: 'rgba(255,255,255,0.02)', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', padding: '24px 0', transition: 'width 0.3s cubic-bezier(.4,0,.2,1)', overflow: 'hidden', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '0 18px 28px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: sidebar ? 'flex-start' : 'center' }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#5227FF,#9B59B6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📊</div>
          {sidebar && <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Trade<span style={{ color: C.purple }}>Daddy</span></span>}
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: '0 10px' }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setPage(item.id)} title={!sidebar ? item.label : ''}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: sidebar ? '11px 14px' : '11px 0', justifyContent: sidebar ? 'flex-start' : 'center', border: 'none', borderRadius: 12, cursor: 'pointer', background: page === item.id ? 'rgba(82,39,255,0.2)' : 'transparent', color: page === item.id ? '#fff' : C.muted, fontFamily: 'inherit', fontSize: 14, fontWeight: page === item.id ? 600 : 400, transition: 'all 0.2s', whiteSpace: 'nowrap', borderLeft: page === item.id ? `3px solid ${C.purple}` : '3px solid transparent' }}>
              <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
              {sidebar && item.label}
            </button>
          ))}
        </nav>

        <button onClick={() => setSidebar(!sidebar)} style={{ margin: '0 10px', padding: '10px', border: `1px solid ${C.border}`, borderRadius: 10, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 14, textAlign: 'center' }}>
          {sidebar ? '◀' : '▶'}
        </button>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
        {error && (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.2)', borderRadius: 12, color: C.red, fontSize: 13 }}>
            ⚠ {error} — Make sure your Worker is deployed and <code>VITE_API_URL</code> is set in <code>.env</code>
          </div>
        )}

        {page === 'dashboard' && <DashboardHome trades={trades} holdings={holdings} />}
        {page === 'journal'   && <JournalPage   trades={trades} onAdd={handleAddTrade} onDelete={handleDeleteTrade} />}
        {page === 'scanner'   && <Scanner />}
        {page === 'holdings'  && <HoldingsPage  holdings={holdings} onRefresh={loadAll} />}
        {page === 'chat'      && <ChatPage trades={trades} holdings={holdings} />}
        {page === 'settings'  && <SettingsPage />}
      </main>
    </div>
  )
}

function SettingsPage() {
  return (
    <div>
      <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>Settings</h1>
      <p style={{ margin: '0 0 28px', fontSize: 13, color: C.muted }}>Configure your API keys and broker connections.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 520 }}>
        {[
          { label: 'Worker API URL', key: 'VITE_API_URL', hint: 'Your Cloudflare Worker URL (set in .env)' },
          { label: 'Dhan Client ID', key: 'DHAN_CLIENT_ID', hint: 'From Dhan developer portal' },
          { label: 'MT5 Account',    key: 'MT5_ACCOUNT',    hint: 'MetaTrader 5 account number' },
        ].map(({ label, key, hint }) => (
          <div key={key} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{hint}</div>
            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
              {key}=&lt;your value&gt;
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}