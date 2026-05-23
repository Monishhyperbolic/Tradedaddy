import { useNavigate } from "react-router-dom";
import DotGrid from '../components/DotGrid/DotGrid';
import GooeyNav from '../components/navbar/GooeyNav';
import ProfileCard from '../components/profilecard/ProfileCard';
import MagicBento from '../components/features/MagicBento';
import Footer from '../components/Footer';

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
        <section id="home" className="landing-hero" style={{ scrollMarginTop: '160px', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ maxWidth: '720px' }}>
            <h1 style={{ margin: '0 0 24px', fontSize: 'clamp(52px, 8vw, 88px)', fontWeight: 800, letterSpacing: '-0.05em', color: '#fff', lineHeight: 1.1 }}>Welcome to TradeDaddy</h1>
            <button className="landing-start-btn" onClick={goToAuth}>Start</button>
          </div>
        </section>

        <section id="features" className="section-shell section-shell-centered landing-section-spacer" style={{ scrollMarginTop: '5px' }}>
          <div className="section-center-frame">
            <MagicBento />
          </div>
        </section>

        <section id="about" className="section-shell section-shell-centered landing-section-spacer" style={{ scrollMarginTop: '1px' }}>
          <div className="about-grid about-grid-centered">
            <div className="about-card-wrap">
              <ProfileCard name="Made by Monish Aoptil" />
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}

export default Landingpage;
