'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import Link from 'next/link';
import { Container } from './ui/Container';
import { CTA as CTA_COPY } from '@/lib/copy';
import { trackCTAClick } from '@/lib/analytics';

export const CTA = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const handlePrimaryCTA = () => {
    trackCTAClick('final-cta', CTA_COPY.primaryButton);
  };

  const handleSecondaryCTA = () => {
    trackCTAClick('final-cta', CTA_COPY.secondaryButton);
  };

  return (
    <section ref={ref} className="py-16 lg:py-24 bg-gradient-to-br from-amber-50 via-amber-100 to-orange-100">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Main Content */}
          <div className="bg-white rounded-3xl p-8 lg:p-16 shadow-xl border border-amber-200 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-200 to-transparent rounded-full opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-orange-200 to-transparent rounded-full opacity-30"></div>

            <div className="relative">
              {/* Headline */}
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-3xl lg:text-5xl font-bold text-gray-900 mb-6 text-balance"
              >
                {CTA_COPY.headline}
              </motion.h2>

              {/* Subtext */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-lg lg:text-xl text-gray-600 mb-8 max-w-2xl mx-auto"
              >
                {CTA_COPY.subtext}
              </motion.p>

              {/* Primary Text */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="bg-amber-50 rounded-2xl p-6 mb-8 border border-amber-200"
              >
                <p className="text-amber-800 font-semibold text-lg">
                  🎉 {CTA_COPY.primaryText}
                </p>
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link
                    href="/signup"
                    onClick={handlePrimaryCTA}
                    className="btn-primary text-lg px-8 py-4 w-full sm:w-auto shadow-lg"
                  >
                    {CTA_COPY.primaryButton}
                  </Link>
                </motion.div>
                
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <button
                    onClick={handleSecondaryCTA}
                    className="btn-secondary text-lg px-8 py-4 w-full sm:w-auto"
                  >
                    {CTA_COPY.secondaryButton}
                  </button>
                </motion.div>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.6, delay: 1 }}
                className="mt-12 pt-8 border-t border-gray-200"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">14 días</div>
                    <div className="text-sm text-gray-600">Prueba gratuita</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">Sin tarjeta</div>
                    <div className="text-sm text-gray-600">Requerida</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">24/7</div>
                    <div className="text-sm text-gray-600">Soporte incluido</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
};



