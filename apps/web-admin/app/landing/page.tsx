'use client';

import { useEffect } from 'react';
import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { SocialProof } from '../components/SocialProof';
import { Differentiators } from '../components/Differentiators';
import { Features } from '../components/Features';
import { MiniDemo } from '../components/MiniDemo';
import { AnalyticsShowcase } from '../components/AnalyticsShowcase';
import { Pricing } from '../components/Pricing';
import { CTA } from '../components/CTA';
import { FAQ } from '../components/FAQ';
import { Footer } from '../components/Footer';
import { trackPageView } from '@/lib/analytics';

export default function LandingPage() {
  useEffect(() => {
    trackPageView('/');
  }, []);

  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <SocialProof />
      <Differentiators />
      <Features />
      <MiniDemo />
      <AnalyticsShowcase />
      <Pricing />
      <CTA />
      <FAQ />
      <Footer />
    </main>
  );
}
