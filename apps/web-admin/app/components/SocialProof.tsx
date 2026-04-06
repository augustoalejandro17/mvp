'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Container } from './ui/Container';
import { SectionHeading } from './ui/SectionHeading';
import { SOCIAL_PROOF } from '@/lib/copy';

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

export const SocialProof = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-16 lg:py-24 bg-gray-50">
      <Container>
        <SectionHeading
          title={SOCIAL_PROOF.headline}
          className="mb-16"
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {SOCIAL_PROOF.items.map((item, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              transition={{
                duration: 0.6,
                delay: index * 0.15,
                ease: 'easeOut',
              }}
              whileHover={{
                y: -4,
                transition: { type: 'spring', stiffness: 300, damping: 24 },
              }}
              className="group"
            >
              <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 h-full">
                <div className="mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center mb-4 text-2xl">
                    {index === 0 ? '👨‍🏫' : index === 1 ? '🏫' : '🎬'}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {item.title}
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="w-0 group-hover:w-12 h-1 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full mt-6 transition-all duration-300"></div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 pt-16 border-t border-gray-200"
        >
          <div className="bg-white rounded-3xl border border-amber-200 p-8 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-600 mb-3">
              {SOCIAL_PROOF.noteTitle}
            </p>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              {SOCIAL_PROOF.noteDescription}
            </p>
          </div>
        </motion.div>
      </Container>
    </section>
  );
};


