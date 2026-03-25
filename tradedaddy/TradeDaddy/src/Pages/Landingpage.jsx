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
    <div style={{ width: '100vw', overflowX: 'hidden' }}>
      {/* ================= BACKGROUND ================= */}
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

      {/* ================= NAVBAR ================= */}
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

      {/* ================= PAGE CONTENT ================= */}
      <main style={{ position: 'relative', zIndex: 1 }}>
        {/* ================= HERO ================= */}
        <section
          id="home"
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: '#fff',
            scrollMarginTop: '160px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            <BlurText
              text="Welcome to TradeDaddy!"
              delay={150}
              animateBy="words"
              direction="top"
              style={{
                fontSize: '65px',
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            />
<button
  onClick={goToAuth}
  style={{
    position: "relative",
    padding: "18px 52px",
    fontSize: "18px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    borderRadius: "16px",
    border: "2px solid #fff",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    overflow: "hidden",
    transition: "color 0.35s ease"
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.color = "#000";
    e.currentTarget.querySelector(".fill").style.transform = "translateX(0)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.color = "#fff";
    e.currentTarget.querySelector(".fill").style.transform = "translateX(100%)";
  }}
>
  <span
    className="fill"
    style={{
      position: "absolute",
      inset: 0,
      background: "#fff",
      borderRadius: "14px",
      zIndex: -1,
      transform: "translateX(100%)",
      transition: "transform 0.35s ease"
    }}
  />
  Get Started
</button>

          </div>
        </section>

        {/* ================= FEATURES ================= */}
        <section
          id="features"
          style={{
            padding: '80px 10%',
            color: '#fff',
            scrollMarginTop: '5px',
          }}
        >
          <h2
            style={{
              fontSize: '48px',
              marginBottom: '40px',
            }}
          >
            Features
          </h2>

          <MagicBento />
        </section>

        {/* ================= ABOUT ================= */}
        <section
          id="about"
          style={{
            padding: '170px 10%',
            color: '#fff',
            scrollMarginTop: '1px',
          }}
        >
          <div
            style={{
              maxWidth: '1200px',
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: '1fr 1.2fr',
              gap: '80px',
              alignItems: 'flex-start',
            }}
          >
            <ProfileCard/>

            <div>
              <h2 style={{ fontSize: '48px', marginBottom: 24 }}>About</h2>
              <p
                style={{
                  fontSize: '18px',
                  lineHeight: 1.7,
                  opacity: 0.9,
                }}
              >
                TradeDaddy is a personal trading analytics platform focused on
                clarity and discipline. It helps traders understand performance,
                mistakes, emotional bias, and strategy effectiveness through
                structured data and modern tools.
              </p>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}

export default Landingpage;
