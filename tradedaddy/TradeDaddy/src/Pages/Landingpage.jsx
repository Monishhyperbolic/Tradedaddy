import { useNavigate } from "react-router-dom";
import DotGrid from '../components/DotGrid/DotGrid';
import BlurText from '../components/Text/BlurText';
import GooeyNav from '../components/navbar/GooeyNav';
import ProfileCard from '../components/profilecard/ProfileCard';
import MagicBento from '../components/features/MagicBento';
import Footer from '../components/Footer';

const highlights = [
  { value: '1 workspace', label: 'for trades, holdings, and review' },
  { value: 'Live sync', label: 'from broker-connected holdings' },
  { value: 'AI feedback', label: 'built around your actual journal' },
]

const featureLines = [
  'Trade journaling with emotion and discipline tracking',
  'Broker sync for Dhan and MT5 without manual copying',
  'AI prompts that use your live portfolio context',
  'A cleaner workspace that works on desktop and mobile',
]

function Landingpage() {
  const navigate = useNavigate();

  const items = [
    { label: 'Home', href: '#home' },
    { label: 'Features', href: '#features' },
    { label: 'About', href: '#about' },
  ];

  const goToAuth = () => {
    navigate("/auth");
  };

  return (
    <div className="landing-shell">
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <DotGrid
          dotSize={7.5}
          gap={20}
          baseColor="#271E37"
          activeColor="#5227FF"
          proximity={120}
          speedTrigger={200}
          shockRadius={290}
          shockStrength={5}
          maxSpeed={9000}
          resistance={750}
          returnDuration={2}
        />
      </div>

      <div
        style={{
          position: 'fixed',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
        }}
      >
        <GooeyNav items={items} />
      </div>

      <main style={{ position: 'relative', zIndex: 1 }}>
        <section id="home" className="landing-hero" style={{ scrollMarginTop: '160px' }}>
          <div className="hero-copy">
            <span className="eyebrow">Auto-approval ready trading workspace</span>
            <BlurText
              text="Welcome to TradeDaddy"
              delay={150}
              animateBy="words"
              direction="top"
              style={{
                fontSize: 'clamp(48px, 7vw, 80px)',
                fontWeight: 700,
                lineHeight: 1.02,
                letterSpacing: '-0.05em',
                maxWidth: '12ch',
              }}
            />
            <p>
              Track trades, sync brokers, and review your edge in a workspace built to surface the habits behind your results.
            </p>
            <div className="cta-row">
              <button className="cta-primary" onClick={goToAuth}>Get Started</button>
              <a className="cta-secondary" href="#features">Explore features</a>
            </div>
            <div className="stats-row">
              {highlights.map(item => (
                <div key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-panel">
            <div className="panel-header">
              <div>
                <span className="panel-badge">Built for active traders</span>
                <h2 style={{ marginTop: 12 }}>A calmer view of performance</h2>
              </div>
              <span className="auth-pill">Live journal + broker sync</span>
            </div>

            <p className="panel-quote">
              Everything in one place: journal entries, emotional patterns, holdings, market scans, news, and AI commentary that uses your actual data.
            </p>

            <div className="panel-grid">
              {featureLines.map((line, index) => (
                <div key={line} className="panel-stat">
                  <strong>{String(index + 1).padStart(2, '0')}</strong>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="section-shell" style={{ scrollMarginTop: '5px' }}>
          <div className="section-head" style={{ marginBottom: 20 }}>
            <div>
              <span className="section-kicker">Features</span>
              <h2 style={{ marginTop: 12 }}>Tools that support cleaner decisions</h2>
            </div>
            <p className="section-copy" style={{ maxWidth: 420 }}>
              Use a single workspace to review trade quality, broker data, market scans, news, and calendars without bouncing between screens.
            </p>
          </div>

          <MagicBento />
        </section>

        <section id="about" className="section-shell" style={{ scrollMarginTop: '1px' }}>
          <div className="about-grid">
            <ProfileCard />

            <div className="about-copy">
              <span className="section-kicker">About</span>
              <h2 style={{ marginTop: 12 }}>Designed around discipline, not noise</h2>
              <p style={{ marginTop: 18, fontSize: 18 }}>
                TradeDaddy is a personal trading analytics platform focused on clarity, discipline, and repeatable review. It helps traders understand performance, mistakes, emotional bias, and strategy effectiveness through structured data and a cleaner interface.
              </p>
              <ul>
                <li>Log trades with notes, emotions, screenshots, and discipline scores.</li>
                <li>Sync holdings from connected brokers instead of maintaining duplicates.</li>
                <li>Keep the dashboard readable on desktop and mobile so the workflow stays fast.</li>
              </ul>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}

export default Landingpage;
