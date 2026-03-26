import { useState, useEffect } from 'react'
import { getQuote, hfChat } from '../utils/api'

const C = {
  s: 'rgba(255,255,255,0.03)',
  b: 'rgba(255,255,255,0.07)',
  p: '#5227FF',
  g: '#34C77B',
  r: '#FF5C5C',
  a: '#F59E0B',
  m: 'rgba(255,255,255,0.4)'
}

const SECTORS = [
  {
    id: 'it',
    label: '💻 IT',
    stocks: ['TCS.NS','INFY.NS','HCLTECH.NS','WIPRO.NS']
  },
  {
    id: 'banking',
    label: '🏦 Banking',
    stocks: ['HDFCBANK.NS','ICICIBANK.NS','SBIN.NS']
  },
  {
    id: 'auto',
    label: '🚗 Auto',
    stocks: ['TATAMOTORS.NS','MARUTI.NS']
  }
]

// 🔥 AI helper
async function hfAnalyze(prompt) {
  try {
    return await hfChat(prompt)
  } catch (e) {
    return `AI unavailable: ${e.message}`
  }
}

function SectorCard({ sector, onAvg }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true

    Promise.allSettled(sector.stocks.map(s => getQuote(s)))
      .then(results => {
        if (!alive) return

        const clean = results.map((r, i) =>
          r.status === 'fulfilled'
            ? r.value
            : { symbol: sector.stocks[i], changePct: 0 }
        )

        setData(clean)

        const valid = clean.filter(x => x.changePct != null)
        const avg = valid.length
          ? valid.reduce((s, x) => s + x.changePct, 0) / valid.length
          : 0

        onAvg(sector.id, avg)
      })
      .finally(() => alive && setLoading(false))

    return () => { alive = false }
  }, [sector.id])

  const valid = data.filter(x => x.changePct != null)
  const avg = valid.length
    ? valid.reduce((s, x) => s + x.changePct, 0) / valid.length
    : 0

  const analyze = async () => {
    if (analysis) return setOpen(!open)

    const prompt = `Sector ${sector.label} avg change ${avg.toFixed(2)}%. Should I BUY, HOLD or AVOID?`
    const res = await hfAnalyze(prompt)

    setAnalysis(res)
    setOpen(true)
  }

  return (
    <div style={{
      background: C.s,
      border: `1px solid ${C.b}`,
      borderRadius: 12,
      padding: 16
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>{sector.label}</strong>
        <span style={{ color: avg >= 0 ? C.g : C.r }}>
          {avg >= 0 ? '+' : ''}{avg.toFixed(2)}%
        </span>
      </div>

      <button
        onClick={analyze}
        style={{
          marginTop: 10,
          padding: '6px 10px',
          background: C.p,
          border: 'none',
          color: '#fff',
          borderRadius: 6,
          cursor: 'pointer'
        }}
      >
        🤖 AI
      </button>

      {open && analysis && (
        <div style={{
          marginTop: 10,
          fontSize: 12,
          color: '#ddd'
        }}>
          {analysis}
        </div>
      )}
    </div>
  )
}

export default function SectorAnalysis() {
  const [allData, setAllData] = useState([])

  const updateAvg = (id, avg) => {
    setAllData(prev => {
      const exists = prev.find(x => x.id === id)
      if (exists) {
        return prev.map(x => x.id === id ? { id, avg } : x)
      }
      return [...prev, { id, avg }]
    })
  }

  const sorted = [...allData].sort((a, b) => b.avg - a.avg)

  return (
    <div>
      <h1 style={{ fontSize: 22 }}>Sector Analysis</h1>

      {/* Leaderboard */}
      <div style={{ marginBottom: 20 }}>
        {sorted.map((s, i) => (
          <div key={s.id}>
            {i + 1}. {s.id} → {s.avg.toFixed(2)}%
          </div>
        ))}
      </div>

      {/* Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12
      }}>
        {SECTORS.map(sec => (
          <SectorCard
            key={sec.id}
            sector={sec}
            onAvg={updateAvg}
          />
        ))}
      </div>
    </div>
  )
}