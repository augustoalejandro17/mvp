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
          {SOCIAL_PROOF.testimonials.map((testimonial, index) => (
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
                {/* Quote */}
                <div className="mb-6">
                  <div className="text-amber-500 text-4xl mb-4">"</div>
                  <p className="text-gray-700 leading-relaxed italic">
                    {testimonial.quote}
                  </p>
                </div>

                {/* Author */}
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-600 font-semibold text-lg">
                      {testimonial.author.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {testimonial.author}
                    </div>
                    <div className="text-gray-600 text-sm">
                      {testimonial.role}
                    </div>
                  </div>
                </div>

                {/* Hover accent */}
                <div className="w-0 group-hover:w-12 h-1 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full mt-6 transition-all duration-300"></div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 pt-16 border-t border-gray-200"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                500+
              </div>
              <div className="text-gray-600">
                Academias activas
              </div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                25k+
              </div>
              <div className="text-gray-600">
                Estudiantes conectados
              </div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                4.8/5
              </div>
              <div className="text-gray-600">
                Satisfacción promedio
              </div>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
};



