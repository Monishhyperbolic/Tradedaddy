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
        <section id="home" className="landing-hero" style={{ scrollMarginTop: '160px' }}>
          <div className="hero-copy">
          </div>

          <div className="hero-panel">
          </div>
        </section>

        <section id="features" className="section-shell" style={{ scrollMarginTop: '5px' }}>
          <MagicBento />
        </section>

        <section id="about" className="section-shell" style={{ scrollMarginTop: '1px' }}>
          <div className="about-grid">
            <ProfileCard />

            <div className="about-copy" />
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}

export default Landingpage;
