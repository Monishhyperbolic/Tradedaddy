/**
 * SectorAnalysis.jsx — Indian Sector Screener
 * Uses Yahoo Finance via Worker proxy
 * HuggingFace for AI analysis
 */
import { useState, useEffect, useCallback } from 'react'
import { getQuote } from '../utils/api'

const C = { s:'rgba(255,255,255,0.03)', b:'rgba(255,255,255,0.07)', p:'#5227FF', g:'#34C77B', r:'#FF5C5C', a:'#F59E0B', m:'rgba(255,255,255,0.4)', f:'rgba(255,255,255,0.06)' }

const SECTORS = [
  { id:'it',          label:'💻 Information Technology', color:'#6C5CE7',
    etf:'NIFTYIT.NS',
    stocks:[{s:'TCS.NS',n:'TCS'},{s:'INFY.NS',n:'Infosys'},{s:'HCLTECH.NS',n:'HCL Tech'},{s:'WIPRO.NS',n:'Wipro'},{s:'TECHM.NS',n:'Tech Mahindra'},{s:'LTIM.NS',n:'LTIMindtree'}] },
  { id:'banking',     label:'🏦 Banking & Finance', color:'#0984E3',
    etf:'BANKNIFTY.NS',
    stocks:[{s:'HDFCBANK.NS',n:'HDFC Bank'},{s:'ICICIBANK.NS',n:'ICICI Bank'},{s:'SBIN.NS',n:'SBI'},{s:'KOTAKBANK.NS',n:'Kotak'},{s:'AXISBANK.NS',n:'Axis Bank'},{s:'BAJFINANCE.NS',n:'Bajaj Finance'}] },
  { id:'pharma',      label:'💊 Pharma & Healthcare', color:'#00B894',
    etf:'NIFTYPHARMA.NS',
    stocks:[{s:'SUNPHARMA.NS',n:'Sun Pharma'},{s:'DRREDDY.NS',n:"Dr Reddy's"},{s:'CIPLA.NS',n:'Cipla'},{s:'DIVISLAB.NS',n:"Divi's Lab"},{s:'APOLLOHOSP.NS',n:'Apollo Hosp'},{s:'LUPIN.NS',n:'Lupin'}] },
  { id:'auto',        label:'🚗 Automobile', color:'#FDCB6E',
    etf:'NIFTYAUTO.NS',
    stocks:[{s:'MARUTI.NS',n:'Maruti'},{s:'TATAMOTORS.NS',n:'Tata Motors'},{s:'BAJAJ-AUTO.NS',n:'Bajaj Auto'},{s:'HEROMOTOCO.NS',n:'Hero MotoCorp'},{s:'EICHERMOT.NS',n:'Eicher'},{s:'MOTHERSON.NS',n:'Motherson'}] },
  { id:'energy',      label:'⚡ Energy & Power', color:'#E17055',
    etf:'NIFTYENERGY.NS',
    stocks:[{s:'RELIANCE.NS',n:'Reliance'},{s:'ONGC.NS',n:'ONGC'},{s:'NTPC.NS',n:'NTPC'},{s:'POWERGRID.NS',n:'Power Grid'},{s:'ADANIGREEN.NS',n:'Adani Green'},{s:'TATAPOWER.NS',n:'Tata Power'}] },
  { id:'fmcg',        label:'🛒 FMCG', color:'#A29BFE',
    etf:'NIFTYFMCG.NS',
    stocks:[{s:'HINDUNILVR.NS',n:'HUL'},{s:'ITC.NS',n:'ITC'},{s:'NESTLEIND.NS',n:'Nestle'},{s:'BRITANNIA.NS',n:'Britannia'},{s:'MARICO.NS',n:'Marico'},{s:'GODREJCP.NS',n:'Godrej CP'}] },
  { id:'realestate',  label:'🏢 Real Estate', color:'#FD79A8',
    etf:'NIFTYREALTY.NS',
    stocks:[{s:'DLF.NS',n:'DLF'},{s:'GODREJPROP.NS',n:'Godrej Prop'},{s:'OBEROIRLTY.NS',n:'Oberoi Realty'},{s:'PRESTIGE.NS',n:'Prestige'},{s:'PHOENIXLTD.NS',n:'Phoenix'},{s:'BRIGADE.NS',n:'Brigade'}] },
  { id:'metals',      label:'⚙ Metals & Mining', color:'#636E72',
    etf:'NIFTYMETAL.NS',
    stocks:[{s:'TATASTEEL.NS',n:'Tata Steel'},{s:'JSWSTEEL.NS',n:'JSW Steel'},{s:'HINDALCO.NS',n:'Hindalco'},{s:'VEDL.NS',n:'Vedanta'},{s:'SAIL.NS',n:'SAIL'},{s:'NMDC.NS',n:'NMDC'}] },
]

// HuggingFace Inference API — free tier
const HF_API = 'https://router.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3'
// Set your HF token in localStorage: localStorage.setItem('hf_token', 'hf_xxx...')

async function hfAnalyze(prompt) {
  const token = localStorage.getItem('hf_token') || ''
  const headers = { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) }
  try {
    const res = await fetch(HF_API, {
      method:'POST', headers,
      body: JSON.stringify({
        inputs: `<s>[INST] You are an expert Indian stock market analyst. ${prompt} Give a concise 3-sentence analysis with specific action recommendation. [/INST]`,
        parameters: { max_new_tokens:200, temperature:0.7, return_full_text:false }
      })
    })
    if (!res.ok) throw new Error(`HF API ${res.status}`)
    const data = await res.json()
    return (data[0]?.generated_text || 'Analysis unavailable.').trim()
  } catch(e) {
    return `AI analysis unavailable. ${token?e.message:'Set your HuggingFace token: open browser console → localStorage.setItem("hf_token", "hf_your_token_here")'}`
  }
}

function TrendBadge({ pct }) {
  const up = pct >= 0
  const strong = Math.abs(pct) > 1
  if (up && strong)  return <span style={{ padding:'3px 10px',borderRadius:999,fontSize:11,fontWeight:800,background:'rgba(52,199,123,0.15)',color:C.g,border:'1px solid rgba(52,199,123,0.3)' }}>🔥 Strongly Bullish</span>
  if (up && !strong) return <span style={{ padding:'3px 10px',borderRadius:999,fontSize:11,fontWeight:700,background:'rgba(52,199,123,0.1)',color:C.g,border:'1px solid rgba(52,199,123,0.25)' }}>▲ Bullish</span>
  if (!up && strong) return <span style={{ padding:'3px 10px',borderRadius:999,fontSize:11,fontWeight:800,background:'rgba(255,92,92,0.15)',color:C.r,border:'1px solid rgba(255,92,92,0.3)' }}>📉 Strongly Bearish</span>
  return <span style={{ padding:'3px 10px',borderRadius:999,fontSize:11,fontWeight:700,background:'rgba(255,92,92,0.1)',color:C.r,border:'1px solid rgba(255,92,92,0.25)' }}>▼ Bearish</span>
}

function MiniBar({ pct, max }) {
  const w = Math.min(Math.abs(pct)/Math.max(max,1)*100, 100)
  return (
    <div style={{ height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden',marginTop:4 }}>
      <div style={{ height:'100%',width:`${w}%`,background:pct>=0?C.g:C.r,borderRadius:2,transition:'width 0.6s ease' }} />
    </div>
  )
}

function SectorCard({ sector, onAnalyze }) {
  const [quotes,   setQuotes]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing,setAnalyzing]= useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      try {
        const results = await Promise.allSettled(sector.stocks.map(s => getQuote(s.s)))
        if (!alive) return
        const q = results.map((r,i) => r.status==='fulfilled' ? {...r.value, displayName:sector.stocks[i].n} : { displayName:sector.stocks[i].n, changePct:null, price:null, error:true })
        setQuotes(q)
      } catch{}
      setLoading(false)
    }
    load()
    return ()=>{alive=false}
  }, [sector.id])

  const validQuotes  = quotes.filter(q => q.changePct != null)
  const avgChange    = validQuotes.length ? validQuotes.reduce((s,q)=>s+q.changePct,0)/validQuotes.length : 0
  const advancers    = validQuotes.filter(q=>q.changePct>=0).length
  const decliners    = validQuotes.filter(q=>q.changePct<0).length
  const maxAbs       = Math.max(...validQuotes.map(q=>Math.abs(q.changePct||0)),1)

  const analyze = async () => {
    if (analysis) { setExpanded(v=>!v); return }
    setAnalyzing(true)
    const stockSummary = validQuotes.map(q=>`${q.displayName}: ${q.changePct>=0?'+':''}${q.changePct?.toFixed(2)}%`).join(', ')
    const prompt = `Analyze the Indian ${sector.label} sector. Today's performance: ${stockSummary}. Average sector change: ${avgChange>=0?'+':''}${avgChange.toFixed(2)}%. ${advancers} stocks advancing, ${decliners} declining. Should an investor BUY, HOLD, or AVOID this sector today?`
    const text = await hfAnalyze(prompt)
    setAnalysis(text)
    setExpanded(true)
    setAnalyzing(false)
  }

  const sentiment = avgChange >= 1 ? 'STRONG_BULL' : avgChange >= 0 ? 'BULL' : avgChange >= -1 ? 'BEAR' : 'STRONG_BEAR'
  const sentimentColors = { STRONG_BULL:C.g, BULL:'rgba(52,199,123,0.7)', BEAR:'rgba(255,92,92,0.7)', STRONG_BEAR:C.r }

  return (
    <div style={{ background:C.s, border:`1px solid ${expanded?sector.color+'55':C.b}`, borderRadius:18, padding:'20px 22px', transition:'border-color 0.2s', position:'relative', overflow:'hidden' }}>
      {/* Color accent bar */}
      <div style={{ position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${sector.color},transparent)` }} />

      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14 }}>
        <div>
          <div style={{ fontSize:16,fontWeight:800,marginBottom:4 }}>{sector.label}</div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {loading ? <span style={{ fontSize:12,color:C.m }}>Loading…</span> : <TrendBadge pct={avgChange} />}
            {!loading && <span style={{ fontSize:14,fontWeight:800,color:avgChange>=0?C.g:C.r }}>{avgChange>=0?'+':''}{avgChange.toFixed(2)}%</span>}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:12,color:C.m,marginBottom:4 }}>{advancers}▲ {decliners}▼</div>
          <button onClick={analyze} disabled={analyzing} style={{ padding:'6px 14px',background:analysis?'rgba(82,39,255,0.15)':C.p,border:`1px solid ${analysis?'rgba(82,39,255,0.3)':'transparent'}`,borderRadius:9,color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:analyzing?0.7:1,whiteSpace:'nowrap' }}>
            {analyzing?'🤖 Thinking…':analysis?(expanded?'▲ Hide':'▼ AI View'):'🤖 AI Analyse'}
          </button>
        </div>
      </div>

      {/* Stock bars */}
      {!loading && (
        <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:12 }}>
          {validQuotes.sort((a,b)=>Math.abs(b.changePct||0)-Math.abs(a.changePct||0)).map(q=>(
            <div key={q.displayName}>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:12 }}>
                <span style={{ color:'rgba(255,255,255,0.75)',fontWeight:600 }}>{q.displayName}</span>
                <span style={{ fontWeight:700,color:q.changePct>=0?C.g:C.r }}>{q.changePct>=0?'+':''}{q.changePct?.toFixed(2)}%</span>
              </div>
              <MiniBar pct={q.changePct||0} max={maxAbs} />
            </div>
          ))}
        </div>
      )}

      {/* AI Analysis */}
      {expanded && analysis && (
        <div style={{ marginTop:10,padding:'12px 14px',background:`${sector.color}11`,borderRadius:12,border:`1px solid ${sector.color}33`,fontSize:13,color:'rgba(255,255,255,0.85)',lineHeight:1.65,borderLeft:`3px solid ${sector.color}` }}>
          🤖 {analysis}
        </div>
      )}
    </div>
  )
}

function SectorRanking({ sectors, allData }) {
  const ranked = allData
    .filter(d => d.avg != null)
    .sort((a,b) => b.avg - a.avg)

  return (
    <div style={{ background:C.s,border:`1px solid ${C.b}`,borderRadius:16,padding:'20px 22px' }}>
      <h3 style={{ margin:'0 0 14px',fontSize:14,fontWeight:700,color:C.m }}>Sector Leaderboard — Today</h3>
      <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
        {ranked.map((d,i) => {
          const sec = sectors.find(s=>s.id===d.id)
          return (
            <div key={d.id} style={{ display:'flex',alignItems:'center',gap:12 }}>
              <span style={{ fontSize:13,color:C.m,width:20,textAlign:'right' }}>{i+1}</span>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:3 }}>
                  <span style={{ fontWeight:600 }}>{sec?.label||d.id}</span>
                  <span style={{ fontWeight:800,color:d.avg>=0?C.g:C.r }}>{d.avg>=0?'+':''}{d.avg.toFixed(2)}%</span>
                </div>
                <div style={{ height:5,background:'rgba(255,255,255,0.06)',borderRadius:3,overflow:'hidden' }}>
                  <div style={{ height:'100%',width:`${Math.min(Math.abs(d.avg)/3*100,100)}%`,background:d.avg>=0?C.g:C.r,borderRadius:3 }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SectorAnalysis() {
  const [allData,      setAllData]      = useState([]) // [{id, avg}]
  const [hfTokenInput, setHfTokenInput] = useState('')
  const [tokenSet,     setTokenSet]     = useState(!!localStorage.getItem('hf_token'))
  const [analyzing,    setAnalyzing]    = useState(false)
  const [marketSummary,setMarketSummary]= useState(null)

  // Fetch quick avg for each sector for the leaderboard
  const updateSectorAvg = (id, avg) => {
    setAllData(prev => {
      const ex = prev.findIndex(d=>d.id===id)
      if (ex>=0) { const n=[...prev]; n[ex]={id,avg}; return n }
      return [...prev, {id,avg}]
    })
  }

  const analyzeFullMarket = async () => {
    setAnalyzing(true)
    const summary = allData.map(d=>{
      const sec=SECTORS.find(s=>s.id===d.id)
      return `${sec?.label||d.id}: ${d.avg>=0?'+':''}${d.avg.toFixed(2)}%`
    }).join('; ')
    const prompt = `Indian stock market sector performance today: ${summary}. Which sectors should an Indian retail investor focus on today? What is the overall market sentiment?`
    const text = await hfAnalyze(prompt)
    setMarketSummary(text)
    setAnalyzing(false)
  }

  const saveToken = () => {
    if (!hfTokenInput.startsWith('hf_')) { alert('Token should start with hf_'); return }
    localStorage.setItem('hf_token', hfTokenInput)
    setTokenSet(true)
    setHfTokenInput('')
  }

  const bullish  = allData.filter(d=>d.avg>=0).length
  const bearish  = allData.filter(d=>d.avg<0).length

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20 }}>
        <div>
          <h1 style={{ margin:'0 0 4px',fontSize:22,fontWeight:800 }}>Sector Analysis</h1>
          <p style={{ margin:0,fontSize:13,color:C.m }}>
            Indian equity sectors · Live NSE data · {bullish > 0 && <span style={{ color:C.g }}>{bullish} bullish</span>}{bullish>0&&bearish>0&&' · '}{bearish > 0 && <span style={{ color:C.r }}>{bearish} bearish</span>}
          </p>
        </div>
        {allData.length > 0 && (
          <button onClick={analyzeFullMarket} disabled={analyzing} style={{ padding:'10px 18px',background:analyzing?'rgba(82,39,255,0.4)':C.p,border:'none',borderRadius:12,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>
            {analyzing?'🤖 Thinking…':'🤖 Full Market AI'}
          </button>
        )}
      </div>

      {/* HF Token setup */}
      {!tokenSet && (
        <div style={{ background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:14,padding:'16px 18px',marginBottom:20 }}>
          <div style={{ fontWeight:700,fontSize:14,marginBottom:6 }}>⚡ Set HuggingFace API Token for AI Analysis (Free)</div>
          <div style={{ fontSize:12,color:C.m,marginBottom:10 }}>Get a free token at <a href="https://huggingface.co/settings/tokens" target="_blank" style={{ color:C.p }}>huggingface.co/settings/tokens</a> (read access is enough)</div>
          <div style={{ display:'flex',gap:10 }}>
            <input value={hfTokenInput} onChange={e=>setHfTokenInput(e.target.value)} placeholder="hf_xxxxxxxxxxxxxxxx"
              style={{ flex:1,padding:'9px 12px',background:'rgba(255,255,255,0.05)',border:`1px solid ${C.b}`,borderRadius:10,color:'#fff',fontSize:13,outline:'none',fontFamily:'monospace' }}
              onFocus={e=>e.target.style.borderColor=C.p} onBlur={e=>e.target.style.borderColor=C.b} />
            <button onClick={saveToken} style={{ padding:'9px 20px',background:C.a,border:'none',borderRadius:10,color:'#000',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>Save Token</button>
          </div>
        </div>
      )}
      {tokenSet && (
        <div style={{ padding:'8px 14px',background:'rgba(52,199,123,0.08)',border:'1px solid rgba(52,199,123,0.2)',borderRadius:12,fontSize:12,color:C.g,marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          ✅ HuggingFace token active — AI analysis enabled
          <button onClick={()=>{localStorage.removeItem('hf_token');setTokenSet(false)}} style={{ background:'none',border:'none',color:C.m,cursor:'pointer',fontSize:11 }}>Remove</button>
        </div>
      )}

      {/* Market summary */}
      {marketSummary && (
        <div style={{ background:'rgba(82,39,255,0.08)',border:'1px solid rgba(82,39,255,0.25)',borderRadius:14,padding:'16px 18px',marginBottom:20 }}>
          <div style={{ fontSize:12,fontWeight:700,color:C.m,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8 }}>🤖 Full Market AI Summary</div>
          <p style={{ margin:0,fontSize:14,color:'rgba(255,255,255,0.9)',lineHeight:1.7 }}>{marketSummary}</p>
        </div>
      )}

      <div style={{ display:'grid',gridTemplateColumns:'1fr 320px',gap:20 }}>
        {/* Sector cards */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14 }}>
          {SECTORS.map(sector => (
            <SectorCardWrapper key={sector.id} sector={sector} onAvgUpdate={avg=>updateSectorAvg(sector.id,avg)} />
          ))}
        </div>
        {/* Leaderboard */}
        <div>
          <SectorRanking sectors={SECTORS} allData={allData} />
          <div style={{ marginTop:16,padding:'14px 16px',background:C.s,border:`1px solid ${C.b}`,borderRadius:14,fontSize:12,color:C.m,lineHeight:1.7 }}>
            📊 <strong style={{ color:'rgba(255,255,255,0.7)' }}>How to use:</strong> Check leaderboard for top sectors, then expand individual cards for AI analysis. Green = Buy opportunity, Red = Avoid or short-term caution.
            <br/><br/>💡 Set your HuggingFace token above for AI sector analysis powered by Mistral 7B.
          </div>
        </div>
      </div>
    </div>
  )
}

// Wrapper that reports avg change up
function SectorCardWrapper({ sector, onAvgUpdate }) {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.allSettled(sector.stocks.map(s => getQuote(s.s)))
      .then(results => {
        if (!alive) return
        const q = results.map((r,i) => r.status==='fulfilled'?{...r.value,displayName:sector.stocks[i].n}:{displayName:sector.stocks[i].n,changePct:null,error:true})
        setQuotes(q)
        const valid = q.filter(x=>x.changePct!=null)
        if (valid.length) onAvgUpdate(valid.reduce((s,x)=>s+x.changePct,0)/valid.length)
      })
      .finally(()=>{ if(alive) setLoading(false) })
    return ()=>{alive=false}
  }, [sector.id])

  const valid = quotes.filter(q=>q.changePct!=null)
  const avg   = valid.length ? valid.reduce((s,q)=>s+q.changePct,0)/valid.length : 0
  const maxAbs = Math.max(...valid.map(q=>Math.abs(q.changePct||0)),1)
  const adv = valid.filter(q=>q.changePct>=0).length, dec = valid.filter(q=>q.changePct<0).length

  const analyze = async () => {
    if (analysis){setExpanded(v=>!v);return}
    setAnalyzing(true)
    const sum = valid.map(q=>`${q.displayName}:${q.changePct>=0?'+':''}${q.changePct?.toFixed(2)}%`).join(', ')
    const text = await hfAnalyze(`Analyze Indian ${sector.label} sector. Stocks: ${sum}. Avg change: ${avg>=0?'+':''}${avg.toFixed(2)}%. Should investors BUY, HOLD or AVOID? Give specific recommendation.`)
    setAnalysis(text); setExpanded(true); setAnalyzing(false)
  }

  return (
    <div style={{ background:C.s,border:`1px solid ${expanded?sector.color+'55':C.b}`,borderRadius:18,padding:'18px 20px',transition:'border-color 0.2s',position:'relative',overflow:'hidden' }}>
      <div style={{ position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${sector.color},transparent)` }} />
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12 }}>
        <div>
          <div style={{ fontSize:14,fontWeight:800,marginBottom:4 }}>{sector.label}</div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {loading?<span style={{ fontSize:11,color:C.m }}>Loading…</span>:<>
              {avg>=1&&<span style={{ padding:'2px 8px',borderRadius:999,fontSize:10,fontWeight:800,background:'rgba(52,199,123,0.15)',color:C.g,border:'1px solid rgba(52,199,123,0.3)' }}>🔥 Strong Bull</span>}
              {avg>=0&&avg<1&&<span style={{ padding:'2px 8px',borderRadius:999,fontSize:10,fontWeight:700,background:'rgba(52,199,123,0.1)',color:C.g,border:'1px solid rgba(52,199,123,0.2)' }}>▲ Bullish</span>}
              {avg<0&&avg>=-1&&<span style={{ padding:'2px 8px',borderRadius:999,fontSize:10,fontWeight:700,background:'rgba(255,92,92,0.1)',color:C.r,border:'1px solid rgba(255,92,92,0.2)' }}>▼ Bearish</span>}
              {avg<-1&&<span style={{ padding:'2px 8px',borderRadius:999,fontSize:10,fontWeight:800,background:'rgba(255,92,92,0.15)',color:C.r,border:'1px solid rgba(255,92,92,0.3)' }}>📉 Strong Bear</span>}
              <span style={{ fontSize:13,fontWeight:800,color:avg>=0?C.g:C.r }}>{avg>=0?'+':''}{avg.toFixed(2)}%</span>
            </>}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          {!loading&&<div style={{ fontSize:11,color:C.m,marginBottom:4 }}>{adv}▲ {dec}▼</div>}
          <button onClick={analyze} disabled={analyzing} style={{ padding:'5px 12px',background:analysis?'rgba(82,39,255,0.15)':C.p,border:`1px solid ${analysis?'rgba(82,39,255,0.3)':'transparent'}`,borderRadius:8,color:'#fff',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:analyzing?0.7:1,whiteSpace:'nowrap' }}>
            {analyzing?'🤖…':analysis?(expanded?'▲':'🤖 View'):'🤖 AI'}
          </button>
        </div>
      </div>
      {!loading&&(
        <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
          {valid.sort((a,b)=>Math.abs(b.changePct||0)-Math.abs(a.changePct||0)).map(q=>(
            <div key={q.displayName}>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:11 }}>
                <span style={{ color:'rgba(255,255,255,0.65)' }}>{q.displayName}</span>
                <span style={{ fontWeight:700,color:q.changePct>=0?C.g:C.r }}>{q.changePct>=0?'+':''}{q.changePct?.toFixed(2)}%</span>
              </div>
              <div style={{ height:3,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden',marginTop:3 }}>
                <div style={{ height:'100%',width:`${Math.min(Math.abs(q.changePct||0)/maxAbs*100,100)}%`,background:q.changePct>=0?C.g:C.r,borderRadius:2 }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {expanded&&analysis&&(
        <div style={{ marginTop:10,padding:'10px 12px',background:`${sector.color}11`,borderRadius:10,border:`1px solid ${sector.color}33`,fontSize:12,color:'rgba(255,255,255,0.85)',lineHeight:1.65,borderLeft:`3px solid ${sector.color}` }}>
          🤖 {analysis}
        </div>
      )}
    </div>
  )
}