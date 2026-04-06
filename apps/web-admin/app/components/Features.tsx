'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Container } from './ui/Container';
import { SectionHeading } from './ui/SectionHeading';
import { CONTACT_MAILTO } from '@/lib/copy';
import { FEATURES } from '@/lib/copy';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const Features = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <section id="features" ref={ref} className="py-16 lg:py-24 bg-gray-50">
      <Container>
        <SectionHeading
          subtitle="Características"
          title="Lo que ya puedes resolver hoy"
          description="La landing ahora refleja lo que sí está más trabajado y listo para vender: operación mobile-first para profesores."
          className="mb-16"
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {FEATURES.map((feature, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              transition={{
                duration: 0.5,
                delay: index * 0.08,
                ease: 'easeOut',
              }}
              whileHover={{
                y: -4,
                transition: { type: 'spring', stiffness: 300, damping: 24 },
              }}
              className="group"
            >
              <div className="bg-white rounded-xl p-6 border border-gray-100 hover:border-amber-200 shadow-sm hover:shadow-md transition-all duration-300 h-full">
                {/* Icon */}
                <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl">{feature.icon}</span>
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-gray-900 mb-3 group-hover:text-amber-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {feature.description}
                </p>

                {/* Hover indicator */}
                <div className="w-0 group-hover:w-8 h-0.5 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full mt-4 transition-all duration-300"></div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-16"
        >
          <p className="text-gray-600 mb-6">
            ¿Necesitas una característica específica?
          </p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <a href={CONTACT_MAILTO} className="btn-secondary inline-block">
              Escríbenos
            </a>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
};
