'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import Link from 'next/link';
import { Container } from './ui/Container';
import { SectionHeading } from './ui/SectionHeading';
import { CONTACT_MAILTO, PRICING_TIERS, PRICING_NOTE } from '@/lib/copy';
import { trackPricingView, trackCTAClick } from '@/lib/analytics';

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const Pricing = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const handlePricingClick = (tierName: string) => {
    trackPricingView(tierName);
    trackCTAClick('pricing', `Empezar ${tierName}`);
  };

  return (
    <section id="pricing" ref={ref} className="py-16 lg:py-24 bg-white">
      <Container>
        <SectionHeading
          subtitle="Precios"
          title="Planes fundadores para validar contigo"
          description="En esta etapa buscamos profesores reales, no volumen artificial. Elige una capacidad acorde a tu momento y crece desde ahí."
          className="mb-16"
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
        >
          {PRICING_TIERS.map((tier, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                ease: 'easeOut',
              }}
              whileHover={{
                y: -8,
                scale: tier.popular ? 1.02 : 1.01,
                transition: { type: 'spring', stiffness: 300, damping: 24 },
              }}
              className={`group relative ${tier.popular ? 'lg:-mt-4' : ''}`}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Más popular
                  </div>
                </div>
              )}

              <div
                className={`bg-white rounded-2xl p-8 border-2 transition-all duration-300 h-full ${
                  tier.popular
                    ? 'border-amber-500 shadow-xl'
                    : 'border-gray-200 hover:border-amber-300 shadow-sm hover:shadow-lg'
                }`}
              >
                {/* Header */}
                <div className="text-center mb-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {tier.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">
                    {tier.description}
                  </p>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-gray-900">
                      ${tier.price}
                    </span>
                    <span className="text-gray-600 ml-2">
                      /{tier.period}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-4 mb-8">
                  {tier.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start space-x-3">
                      <div className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-amber-600 text-xs">✓</span>
                      </div>
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full"
                >
                  <a
                    href={CONTACT_MAILTO}
                    onClick={() => handlePricingClick(tier.name)}
                    className={`block w-full text-center py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
                      tier.popular
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    }`}
                  >
                    {tier.cta}
                  </a>
                </motion.div>

                {/* Hover Effect */}
                <div
                  className={`w-0 group-hover:w-full h-1 rounded-full mt-6 transition-all duration-500 ${
                    tier.popular
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                      : 'bg-gradient-to-r from-gray-400 to-gray-500'
                  }`}
                ></div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Pricing Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center"
        >
          <div className="bg-amber-50 rounded-2xl p-8 border border-amber-200">
            <p className="text-amber-800 font-medium mb-4">
              💰 {PRICING_NOTE}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <a href={CONTACT_MAILTO} className="btn-secondary inline-block">
                  Escríbenos
                </a>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <a href={CONTACT_MAILTO} className="btn-primary inline-block">
                  Contactar por correo
                </a>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* FAQ Teaser */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-16"
        >
          <p className="text-gray-600 mb-4">
            ¿Tienes preguntas sobre los planes?
          </p>
          <Link
            href="#faq"
            className="text-amber-600 hover:text-amber-700 font-medium transition-colors"
          >
            Ver preguntas frecuentes →
          </Link>
        </motion.div>
      </Container>
    </section>
  );
};
