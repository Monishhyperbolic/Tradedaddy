import { useNavigate } from "react-router-dom";
import DotGrid from '../components/DotGrid/DotGrid';
import BlurText from '../components/Text/BlurText';
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
        <section id="home" className="landing-hero landing-hero-centered" style={{ scrollMarginTop: '160px' }}>
          <div className="hero-copy hero-copy-centered">
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
            <button className="cta-primary cta-primary-center" onClick={goToAuth}>Start</button>
          </div>
        </section>

        <section id="features" className="section-shell section-shell-centered" style={{ scrollMarginTop: '5px' }}>
          <div className="section-center-frame">
            <MagicBento />
          </div>
        </section>

        <section id="about" className="section-shell section-shell-centered" style={{ scrollMarginTop: '1px' }}>
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
