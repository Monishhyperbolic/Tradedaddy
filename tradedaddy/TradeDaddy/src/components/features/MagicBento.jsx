import { useEffect, useRef } from 'react';
import './MagicBento.css';

const cardData = [
  {
    title: 'Trade Analytics',
    description:
      'Win rate, expectancy, drawdown, and equity curve analysis.',
    label: 'Core'
  },
  {
    title: 'Journal Intelligence',
    description:
      'Tag trades by strategy, emotion, and session.',
    label: 'Insight'
  },
  {
    title: 'Universal CSV Import',
    description:
      'Import MT4, MT5, and broker trade history.',
    label: 'Data'
  },
  {
    title: 'News Impact',
    description:
      'Analyze how macro events affect performance.',
    label: 'Context'
  },
  {
    title: 'Risk Monitoring',
    description:
      'Detect overtrading and rule violations.',
    label: 'Discipline'
  },
  {
    title: 'Why Am I Losing?',
    description:
      'Identify your weakest strategy, session, and bias.',
    label: 'Signature'
  }
];

function MagicBento() {
  const cardsRef = useRef([]);

  useEffect(() => {
    cardsRef.current.forEach(card => {
      if (!card) return;

      const handleMove = e => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        card.style.setProperty('--my', `${e.clientY - rect.top}px`);
      };

      card.addEventListener('mousemove', handleMove);

      return () => {
        card.removeEventListener('mousemove', handleMove);
      };
    });
  }, []);

  return (
    <section className="magic-bento-wrapper">
      <div className="magic-bento-grid">
        {cardData.map((card, i) => (
          <div
            key={i}
            className="magic-bento-card"
            ref={el => (cardsRef.current[i] = el)}
          >
            <span className="magic-bento-label">{card.label}</span>
            <h3 className="magic-bento-title">{card.title}</h3>
            <p className="magic-bento-desc">{card.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default MagicBento;
