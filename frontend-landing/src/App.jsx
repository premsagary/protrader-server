import React, { useEffect } from 'react';
import Nav from './components/Nav';
import Hero from './components/Hero';
import TrustStrip from './components/TrustStrip';
import Transparency from './components/Transparency';
import Features from './components/Features';
import LivePreview from './components/LivePreview';
import HowItWorks from './components/HowItWorks';
import Pricing from './components/Pricing';
import Methodology from './components/Methodology';
import Footer from './components/Footer';

export default function App() {
  // Scroll-reveal observer
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px 0px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <Nav />
      <Hero />
      <TrustStrip />
      <Transparency />
      <Features />
      <LivePreview />
      <HowItWorks />
      <Pricing />
      <Methodology />
      <Footer />
    </div>
  );
}

export const goToApp = () => {
  window.location.href = '/dashboard.html';
};
