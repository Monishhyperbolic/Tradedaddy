// src/components/Footer.jsx
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        {/* LEFT */}
        <div className="footer-brand">
          <h3>TradeDaddy</h3>
          <p>
            A personal trading analytics project focused on clarity,
            discipline, and performance.
          </p>
        </div>

        {/* RIGHT */}
        <div className="footer-links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} TradeDaddy</span>
        <span>Built with React</span>
      </div>
    </footer>
  );
}

export default Footer;
