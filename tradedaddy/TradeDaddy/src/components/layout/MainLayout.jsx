import DotGrid from "../DotGrid/DotGrid";
import GooeyNav from "../navbar/GooeyNav";
import Footer from "../Footer";

export default function MainLayout({ children }) {
  const items = [
    { label: "Home", href: "/" },
    { label: "Features", href: "/#features" },
    { label: "About", href: "/#about" },
  ];

  return (
    <div style={{ width: "100vw", minHeight: "100vh", overflowX: "hidden" }}>
      {/* ==== BACKGROUND GRID ==== */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
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

      {/* ==== NAVBAR ==== */}
      <div
        style={{
          position: "fixed",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
        }}
      >
        <GooeyNav items={items} />
      </div>

      {/* ==== CONTENT ==== */}
      <main style={{ position: "relative", zIndex: 2 }}>
        {children}
      </main>

      {/* ==== FOOTER ==== */}
      <Footer />
    </div>
  );
}
