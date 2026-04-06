'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Container } from './ui/Container';
import { HERO, BRAND } from '@/lib/copy';
import { trackCTAClick } from '@/lib/analytics';

export const Hero = () => {
  const handlePrimaryCTA = () => {
    trackCTAClick('hero', HERO.primaryCTA);
  };

  const handleSecondaryCTA = () => {
    trackCTAClick('hero', HERO.secondaryCTA);
  };

  return (
    <section className="relative pt-20 lg:pt-24 pb-16 lg:pb-20 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-orange-50"></div>
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-gradient-to-bl from-amber-100 to-transparent rounded-full blur-3xl opacity-60"></div>
      <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-gradient-to-tr from-orange-100 to-transparent rounded-full blur-3xl opacity-40"></div>

      <Container className="relative">
        <div className="text-center max-w-4xl mx-auto">
          {/* Pill */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="inline-flex items-center px-4 py-2 rounded-full bg-amber-100 text-amber-800 text-sm font-medium mb-6"
          >
            <span className="w-2 h-2 bg-amber-500 rounded-full mr-2 animate-pulse"></span>
            {HERO.pill}
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 text-balance"
          >
            <span className="gradient-text">{BRAND.name}</span>
            <br />
            <span className="text-gray-900">{HERO.headline}</span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-lg lg:text-xl text-gray-600 mb-8 max-w-3xl mx-auto text-balance"
          >
            {HERO.subtext}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href="/signup"
                onClick={handlePrimaryCTA}
                className="btn-primary text-lg px-8 py-4 w-full sm:w-auto"
              >
                {HERO.primaryCTA}
              </Link>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href="#pricing"
                onClick={handleSecondaryCTA}
                className="btn-secondary text-lg px-8 py-4 w-full sm:w-auto"
              >
                {HERO.secondaryCTA}
              </Link>
            </motion.div>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-12 pt-8 border-t border-gray-200"
          >
            <p className="text-sm text-gray-500 mb-4">
              Enfoque claro para esta etapa
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {HERO.highlights.map((item) => (
                <div
                  key={item.title}
                  className="bg-white rounded-2xl border border-gray-200 p-4 text-left shadow-sm"
                >
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    {item.title}
                  </p>
                  <p className="text-sm text-gray-600">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
};

